/* =====================================================================
 阿历的数字花园 · app.js（v20260808 修复版）
 修复：① 附件上传失败保留重试 ② 详细错误提示 ③ 断网检测
 优化：④ 编辑器自动保存 ⑤ 性能优化 ⑥ 图片懒加载
===================================================================== */

/* ===== 云端 ===== */
const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
let sb = null;
try { sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null; } catch (e) { sb = null; }

/* ===== 工具 ===== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtDate = iso => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
const toastEl = document.getElementById('toast'); let toastTimer = null;
function showToast(h, ms = 4200) { if (!toastEl) return; toastEl.innerHTML = h; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms); }
function compress(file, max = 1000, q = 0.7) { return new Promise(res => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > max || h > max) { if (w > h) { h = h * max / w; w = max; } else { w = w * max / h; h = max; } } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', q)); }; img.src = r.result; }; r.readAsDataURL(file); }); }
function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isPinned = a => (a.tags || []).includes('置顶');
function sortPosts(arr) { return arr.slice().sort((a, b) => { const pa = isPinned(a) ? 1 : 0, pb = isPinned(b) ? 1 : 0; if (pa !== pb) return pb - pa; return new Date(b.created_at) - new Date(a.created_at); }); }
window.__isHTML = function (s) { return /<[a-z][\s\S]*>/i.test(s || ''); };
function toRTEHTML(raw) { raw = raw == null ? '' : String(raw); if (window.__isHTML(raw)) return raw; return raw.split('\n').map(l => { const e = esc(l); return '<p>' + (e || '<br>') + '</p>'; }).join(''); }
function normTxt(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function contentOf(p) { return p && (p.content != null ? p.content : (p.txt != null ? p.txt : '')); }
function plainOf(p) { return String(contentOf(p) || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

/* ===== 乐观发布池 ===== */
const POSTED_LIFE_KEY = 'chi_posts_posted_v1', POSTED_LR_KEY = 'chi_lr_posted_v1';
const getPostedLife = () => { try { const r = JSON.parse(localStorage.getItem(POSTED_LIFE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setPostedLife = a => localStorage.setItem(POSTED_LIFE_KEY, JSON.stringify(a));
const getPostedLR = () => { try { const r = JSON.parse(localStorage.getItem(POSTED_LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setPostedLR = a => localStorage.setItem(POSTED_LR_KEY, JSON.stringify(a));
function dedupePostedArr(arr, key) { return arr.filter(p => { if (!p._posted) return true; const pt = new Date(p.created_at).getTime(); return !arr.some(o => !o._posted && !o._local && (o[key] || '') === (p[key] || '') && Math.abs(new Date(o.created_at).getTime() - pt) < 120000); }); }
function confirmPostedArr(pool, data, key, setFn) { if (!pool.length) return; const remain = pool.filter(p => { const pt = new Date(p.created_at).getTime(); return !data.some(o => (o[key] || '') === (p[key] || '') && Math.abs(new Date(o.created_at).getTime() - pt) < 120000); }); if (remain.length !== pool.length) setFn(remain); }

/* ===== 隐藏名单 ===== */
const LIFE_HIDE_KEY = 'chi_life_hide', LIFE_HIDE_C_KEY = 'chi_life_hide_content';
const getLifeHide = () => { try { const r = JSON.parse(localStorage.getItem(LIFE_HIDE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setLifeHide = a => localStorage.setItem(LIFE_HIDE_KEY, JSON.stringify(a));
function addLifeHideC(k) { if (!k) return; let hc = []; try { const r = JSON.parse(localStorage.getItem(LIFE_HIDE_C_KEY)); if (Array.isArray(r)) hc = r; } catch (e) { } if (!hc.includes(k)) { hc.push(k); localStorage.setItem(LIFE_HIDE_C_KEY, JSON.stringify(hc)); } }
function lifeHideSets() {
  let hid = [], hidc = [];
  try { const r = JSON.parse(localStorage.getItem(LIFE_HIDE_KEY)); if (Array.isArray(r)) hid = r; } catch (e) { }
  try { const r = JSON.parse(localStorage.getItem(LIFE_HIDE_C_KEY)); if (Array.isArray(r)) hidc = r; } catch (e) { }
  return { hidSet: new Set(hid.map(String)), hidCSet: new Set(hidc) };
}
function lifeIsHiddenObj(p, sets) {
  if (sets.hidSet.has(String(p && p.id))) return true;
  const k = normTxt(contentOf(p));
  return k ? sets.hidCSet.has(k) : false;
}

/* ===== 图片上传：优先 Storage，断网 fallback base64 ===== */
const IMG_BUCKET = 'learning-images';
async function uploadImageToStorage(file) {
  if (!sb) throw new Error('Supabase 未连接');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(IMG_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  return sb.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl;
}
async function processImageUpload(file, arr, renderFn) {
  const placeholder = { _uploading: true, name: file.name };
  arr.push(placeholder); renderFn();
  const idx = arr.length - 1;
  try { 
    if (sb && navigator.onLine) { 
      arr[idx] = await uploadImageToStorage(file); 
    } else { 
      arr[idx] = await compress(file); 
    } 
  }
  catch (err) {
    try { arr[idx] = await compress(file); }
    catch (e2) { arr.splice(idx, 1); showToast('「' + esc(file.name) + '」上传失败'); renderFn(); return; }
  }
  renderFn();
}
async function migrateImagesToStorage(images) {
  const out = [];
  for (const s of images || []) {
    if (!s || typeof s !== 'string' || !s.startsWith('data:image')) { out.push(s); continue; }
    try {
      const res = await fetch(s); const blob = await res.blob();
      out.push(await uploadImageToStorage(new File([blob], 'image.jpg', { type: 'image/jpeg' })));
    } catch (e) { out.push(s); }
  }
  return out;
}

/* ===== 附件上传（修复版） ===== */
const ATT_BUCKET = 'attachments';
const ATT_MAX = 20 * 1024 * 1024;
function fileIcon(name) {
  const e = (name || '').split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(e)) return 'fa-file-excel';
  if (['doc', 'docx', 'md', 'txt'].includes(e)) return 'fa-file-word';
  if (['ppt', 'pptx'].includes(e)) return 'fa-file-powerpoint';
  if (e === 'pdf') return 'fa-file-pdf';
  if (e === 'zip') return 'fa-file-zipper';
  return 'fa-file';
}
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';

async function uploadAttachment(file) {
  if (!sb) throw new Error('云端未连接，请检查网络或刷新页面');
  if (file.size > ATT_MAX) throw new Error('超过20MB');
  if (!navigator.onLine) throw new Error('网络已断开，请联网后重试');
  
  const safe = (file.name || 'file').replace(/[^\w.\-一-龥]+/g, '_');
  const path = `files/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  
  try {
    const { error } = await sb.storage.from(ATT_BUCKET).upload(path, file, { 
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600'
    });
    if (error) {
      console.error('Supabase upload error:', error);
      if (error.message && error.message.toLowerCase().includes('row-level security')) {
        throw new Error('存储桶权限不足：请在 Supabase Dashboard → Storage → attachments → Policies 添加允许匿名上传的策略');
      }
      if (error.message && (error.message.includes('Bucket not found') || error.message.toLowerCase().includes('bucket'))) {
        throw new Error('存储桶不存在：请在 Supabase Dashboard → Storage 创建名为 "attachments" 的公开存储桶');
      }
      if (error.statusCode === 413 || error.message.includes('too large')) {
        throw new Error('文件太大，请压缩后重试');
      }
      throw new Error(error.message || '上传失败，请检查 Supabase 配置');
    }
    return sb.storage.from(ATT_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (err) {
    console.error('附件上传异常:', err);
    throw err;
  }
}

async function retryAttachmentUpload(idx, file) {
  const f = lrFiles[idx];
  if (!f) return;
  f._uploading = true; 
  f._error = false;
  f.errorMsg = '';
  renderFileList();
  try {
    const url = await uploadAttachment(file);
    Object.assign(f, { _uploading: false, _error: false, url, errorMsg: '' });
    showToast(`附件「${esc(file.name)}」上传成功 ✓`);
  } catch (err) {
    Object.assign(f, { _uploading: false, _error: true, errorMsg: err.message || '上传失败' });
    showToast(`附件上传失败：${esc(err.message || '网络或权限问题')}`, 6000);
  }
  renderFileList();
}

/* ===== 路由（整页视图） ===== */
const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('#nav a')];
function revealIn(v) { const els = v.querySelectorAll('.reveal'); els.forEach(e => e.classList.remove('in')); requestAnimationFrame(() => requestAnimationFrame(() => { let i = 0; els.forEach(e => { e.style.transitionDelay = (Math.min(i++, 7) * 0.04) + 's'; e.classList.add('in'); }); })); }
function showView(n) { views.forEach(v => v.classList.toggle('active', v.dataset.view === n)); const c = document.querySelector('.view.active'); if (c) revealIn(c); window.scrollTo(0, 0); }
function setNav(n) { navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === n)); }
function go(target) { const cur = location.hash.replace(/^#/, ''); if (cur === target) { route(); } else { location.hash = target; } }
function curHash() { return location.hash.replace(/^#/, '') || 'home'; }
function primeLearningSync() { if (learningList.length) return; learningList = sortPosts([...SEED_LEARNING, ...getLR().map(x => ({ ...x, _local: true })), ...getPostedLR().map(x => ({ ...x, _posted: true }))]); learningList = applyLocalOverlay(learningList); }
function primeLifeSync() { if (lifeList.length) return; const hide = getLifeHide(); lifeList = sortPosts([...SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })), ...loadLocal().map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]); const sets = lifeHideSets(); lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets)); }
async function route() {
  const h = curHash(); const [view, param] = h.split('/');
  if (view === 'read') {
    primeLearningSync();
    const art = learningList.find(a => String(a.id) === param);
    if (art) { renderRead(art, false); showView('read'); setNav('learning'); } else { showView('learning'); setNav('learning'); }
    loadLearning().then(() => { if (curHash() === 'read/' + param) { const a2 = learningList.find(x => String(x.id) === param); if (a2) renderRead(a2, false); else go('learning'); } });
    return;
  }
  if (view === 'learning') { primeLearningSync(); renderLearningList(); }
  if (view === 'life') { primeLifeSync(); renderPosts(lifeList, false); }
  if (view === 'home') { primeLearningSync(); primeLifeSync(); renderHomeLatest(); renderHomeLife(); renderHomeCases(); }
  const valid = ['home', 'about', 'projects', 'learning', 'life'].includes(view) ? view : 'home';
  showView(valid); setNav(valid);
  if (view === 'learning') { loadLearning().then(() => { if (curHash() === 'learning') renderLearningList(); }); }
  if (view === 'life') { loadPosts().then(() => { if (curHash() === 'life') renderPosts(lifeList, !cloudOK); }); }
  if (view === 'home') {
    loadLearning().then(() => { if (curHash() === 'home') { renderHomeLatest(); renderStats(); renderTagCloud(); renderCal(); } });
    loadPosts().then(() => { if (curHash() === 'home') { renderHomeLife(); renderStats(); renderTagCloud(); renderCal(); } });
  }
}
document.addEventListener('click', e => {
  const sync = e.target.closest('.sync-btn'); if (sync) { e.preventDefault(); e.stopPropagation(); resyncOne(sync.dataset.sync); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { e.preventDefault(); e.stopPropagation(); editLearning(ed.dataset.edit); return; }
  const dl = e.target.closest('[data-del]'); if (dl) { e.preventDefault(); e.stopPropagation(); deleteLearning(dl.dataset.del, dl.dataset.local === '1'); return; }
  const le = e.target.closest('[data-life-edit]'); if (le) { e.preventDefault(); e.stopPropagation(); editLife(le.dataset.lifeEdit); return; }
  const ld = e.target.closest('[data-life-del]'); if (ld) { e.preventDefault(); e.stopPropagation(); deleteLife(ld.dataset.lifeDel, ld.dataset.local === '1'); return; }
  const limg = e.target.closest('.limg'); if (limg) { e.preventDefault(); e.stopPropagation(); openLB(limg.dataset.img || limg.src); return; }
  const pc = e.target.closest('.postcard'); if (pc) { e.preventDefault(); e.stopPropagation(); go('read/' + encodeURIComponent(pc.dataset.id)); return; }
  const a = e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute('href').slice(1)); }
});

/* ===== 项目案例 ===== */
const CASES = [
  { color: 'linear-gradient(135deg,#e8730c,#ff9d4d)', icon: 'fa-layer-group', tag: 'USER VALUE', title: 'RFM 用户价值分析案例', desc: '基于 SQL 取数 + Python(Pandas) 构建 RFM 模型，对线上平台用户做三维度打分与分层，输出可复现的交互式分析报告。', tech: ['SQL', 'Python', 'Pandas', 'Jupyter'], docs: [{ label: '交互式报告', href: '线上平台用户RFM分析.html' }], dl: '线上平台用户RFM分析.ipynb' },
  { color: 'linear-gradient(135deg,#2f6fed,#5b8def)', icon: 'fa-boxes-stacked', tag: 'INVENTORY', title: '快消品进销存分析', desc: '以 Power BI 完成数据建模与清洗，搭建进销存看板 + 分析报告：监控库存、月销与临期风险，完成 ABC 动销与智能补货诊断。', tech: ['Power BI', 'DAX'], docs: [{ label: '演示案例', href: '快消品进销存演示案例.pdf' }, { label: '分析报告', href: '快消品进销存案例分析报告.pdf' }], dl: '快消品进销存演示案例.pbix' },
  { color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: 'fa-rotate', tag: 'RETENTION · LTV', title: '复购与留存分析', desc: '复购专题双报告：销售趋势、留存、新增/复购拆解，以及母婴店铺「黄金60天」转化归因，核心度量以 DAX 实现。', tech: ['Power BI', 'DAX', '归因分析'], docs: [{ label: '演示案例', href: '复购分析案例.pdf' }, { label: '分析报告', href: '复购案例分析.pdf' }], dl: '复购分析案例.pbix' }
];
function caseHTML(c, i) {
  return `<article class="case reveal" style="animation-delay:${i * 0.06}s">
    <div class="case--row">
      <div class="case-cover" style="background:${c.color}" data-doc0="${c.docs[0] ? esc(c.docs[0].href) : ''}">
        <span class="big">${String(i + 1).padStart(2, '0')}</span>
        <i class="fa-solid ${esc(c.icon)} ci"></i>
        <span class="ctag">${esc(c.tag)}</span>
      </div>
      <div class="case-body">
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.desc)}</p>
        <div class="case-docs">${c.docs.map(d => `<a class="case-doc" href="${esc(d.href)}" target="_blank"><i class="fa-solid fa-file-lines"></i>${esc(d.label)}</a>`).join('')}</div>
        <div class="case-foot">
          <div class="case-tech">${c.tech.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          <a class="case-dl" href="${esc(c.dl)}" download><i class="fa-solid fa-download"></i>源文件</a>
        </div>
      </div>
    </div>
  </article>`;
}
function renderCases() { document.getElementById('caseGrid').innerHTML = CASES.map(caseHTML).join(''); }
function renderHomeCases() {
  const g = document.getElementById('homeCases'), head = document.getElementById('homeCasesHead');
  if (!CASES.length) { if (head) head.style.display = 'none'; g.innerHTML = ''; return; }
  if (head) head.style.display = 'flex';
  g.innerHTML = CASES.slice(0, 2).map(caseHTML).join('');
}
function bindCaseCover(el) { el.addEventListener('click', e => { const cv = e.target.closest('.case-cover'); if (cv && !e.target.closest('.case-doc') && !e.target.closest('.case-dl') && cv.dataset.doc0) window.open(cv.dataset.doc0, '_blank'); }); }
bindCaseCover(document.getElementById('caseGrid'));
bindCaseCover(document.getElementById('homeCases'));

/* ===== 证书 ===== */
const CERTS = [{ n: 'CDA 数据分析师', s: 'LEVEL-1', img: './certs/CDA-LEVEL1.jpg' }, { n: 'Office 计算机', s: '二级证书', img: './certs/office_level2.jpg' }, { n: '英语六级', s: 'CET-6', img: './certs/CET6.jpg' }, { n: '普通话', s: '二甲证书', img: './certs/putonghua.jpg' }];
function renderCerts() { document.getElementById('certGrid').innerHTML = CERTS.map(c => `<div class="cert reveal" data-img="${esc(c.img)}"><div class="thumb"><img src="${esc(c.img)}" alt="${esc(c.n)}" loading="lazy"><div class="zoom"><i class="fa-solid fa-expand"></i>查看大图</div></div><div class="cn">${esc(c.n)}<small>${esc(c.s)}</small></div></div>`).join(''); }
document.getElementById('certGrid').addEventListener('click', e => { const el = e.target.closest('[data-img]'); if (el) openLB(el.dataset.img); });
function openLB(src) { document.getElementById('lbImg').src = src; document.getElementById('lightbox').classList.add('on'); lockScroll(true); }

/* ===== 学习成长：数据 ===== */
const GRADS = ['linear-gradient(135deg,#e8730c,#ff9d4d)', 'linear-gradient(135deg,#2f6fed,#5b8def)', 'linear-gradient(135deg,#1f9d63,#46c98a)', 'linear-gradient(135deg,#8b5cf6,#a78bfa)'];
const SEED_LEARNING = [
  { id: 'seed-1', title: '我用 RFM 把 10 万用户分成 8 类，召回效率翻了一倍', content: '刚入行时运营问我"哪些用户该发券"，我下意识拉消费 Top。后来才懂：高消费不等于该召回——昨天刚买的人发券纯属浪费。\n\nRFM 三维度=三句人话：R 多久没来、F 来得勤不勤、M 花得多不多。\n\n最大坑：阈值用均值，被大户带偏；改分位数后分层稳多了。\n\n方法论的价值在于可迁移——换家公司，字段对上，框架照样跑。', images: [], links: [{ text: 'RFM 模型维基百科', url: 'https://en.wikipedia.org/wiki/RFM_(market_research)' }], tags: ['RFM', 'Python', '用户分层'], emoji: '🎯', created_at: '2026-07-18T09:00:00Z' },
  { id: 'seed-2', title: 'SQL 窗口函数：从看不懂到离不开的 30 天', content: '第一次见 OVER (PARTITION BY ... ORDER BY ...) 是懵的。直到理解成"在每组里按时间排好队，再回头看"，瞬间通了。\n\n三个常用场景：取每组最新一条用 ROW_NUMBER；环比用 LAG；累计用 SUM() OVER (ORDER BY ...)。\n\n练习法：别只看书，出 20 道业务真题，写不出就看答案，但一定自己敲一遍。', images: [], links: [{ text: 'PostgreSQL 窗口函数教程', url: 'https://www.postgresqltutorial.com/postgresql-window-function/' }], tags: ['SQL', '窗口函数', '复盘'], emoji: '🪟', created_at: '2026-07-10T09:00:00Z' },
  { id: 'seed-3', title: '数据分析里我踩过的 5 个认知坑', content: '一年前我还在为 VLOOKUP 焦虑。今天聊的不是函数，是差点让我放弃的认知坑。\n\n1 把"会工具"当"会分析"。2 一上来就建模。3 不敢问业务。4 报告写给自己看。5 只输入不输出。\n\n这个博客就是逼自己输出的产物——写出来，才算真的会。这条路不卷速度，卷持续。', images: [], links: [], tags: ['转行', '成长', '随笔'], emoji: '🌱', created_at: '2026-06-28T09:00:00Z' }
];
let learningList = [], _lp = null;
const LR_KEY = 'chi_lr_drafts';
const getLR = () => { try { const r = JSON.parse(localStorage.getItem(LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setLR = a => localStorage.setItem(LR_KEY, JSON.stringify(a));
async function cleanupCloudDupes(rows) {
  if (!sb || !rows || rows.length < 2) return;
  const seen = new Set(), dupIds = [];
  rows.forEach(r => { const k = normTxt(r.title); if (seen.has(k)) dupIds.push(r.id); else seen.add(k); });
  if (!dupIds.length) return;
  for (const id of dupIds) { try { await sb.from('learning').delete().eq('id', id); } catch (e) { } }
}
async function loadLearning() {
  if (_lp) return _lp; return _lp = (async () => {
    let cloud = null;
    if (sb) {
      try { const res = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(200), 6000); if (!res.error && res.data) cloud = res.data; } catch (e) { }
      if (cloud !== null) {
        const drafts = getLR(); if (drafts.length) { const remain = []; for (const x of drafts) { let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, files: x.files || [], emoji: x.emoji || '📚' }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } setLR(remain); if (remain.length !== drafts.length) { try { const r2 = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(200), 6000); if (!r2.error && r2.data) cloud = r2.data; } catch (e) { } } }
      }
    }
    let cloudArr = cloud ? cloud.map(p => ({ ...p, emoji: p.emoji || '📚' })) : null;
    if (cloudArr && cloudArr.length) {
      const seen = new Set();
      cloudArr = cloudArr.filter(r => { const k = normTxt(r.title); if (seen.has(k)) return false; seen.add(k); return true; });
      cleanupCloudDupes(cloud);
    }
    const useSeed = !cloudArr || cloudArr.length === 0; const base = (cloudArr || []).concat(useSeed ? SEED_LEARNING : []);
    learningList = sortPosts([...base, ...getLR().map(x => ({ ...x, _local: true })), ...getPostedLR().map(x => ({ ...x, _posted: true }))]);
    learningList = applyLocalOverlay(learningList);
    learningList = dedupePostedArr(learningList, 'title');
    confirmPostedArr(getPostedLR(), cloudArr || [], 'title', setPostedLR);
    return { ok: true };
  })();
}
function invalidateLearning() { _lp = null; }
function cardHTML(p, i) {
  const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
  const tags = (p.tags || []).slice(0, 4).map(t => `<span>${esc(t)}</span>`).join(''); const ex = plainOf(p).replace(/https?:\/\/\S+/g, '').slice(0, 120);
  const pinned = isPinned(p) ? `<span class="pin-flag">📌 置顶</span>` : ''; const localFlag = p._local ? `<span class="draft-flag">📍 本机</span>` : '';
  const fileFlag = (p.files && p.files.length) ? `<span class="file-flag"><i class="fa-solid fa-paperclip"></i>${p.files.length}</span>` : '';
  const mgmt = `<div class="pc-mgmt">${p._local ? `<button class="pc-m sync-btn" data-sync="${esc(p.id)}" title="同步到云端"><i class="fa-solid fa-cloud-arrow-up"></i></button>` : ''}<button class="pc-m" data-edit="${esc(p.id)}" title="编辑"><i class="fa-solid fa-pen"></i></button><button class="pc-m pc-m-del" data-del="${esc(p.id)}" data-local="${p._local ? '1' : '0'}" title="删除"><i class="fa-solid fa-trash"></i></button></div>`;
  return `<article class="postcard reveal" data-id="${esc(p.id)}" style="animation-delay:${i * 0.04}s"><div class="postcard--row"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '📚'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>${pinned}${localFlag}${fileFlag}</div><h3 class="pc-title">${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p><div class="pc-tags">${tags}</div></div></div>${mgmt}</article>`;
}
let lrQuery = '';
function renderLearningList() {
  const g = document.getElementById('learningGrid');
  let list = learningList;
  if (lrQuery) { const q = lrQuery.toLowerCase(); list = list.filter(p => (p.title || '').toLowerCase().includes(q) || plainOf(p).toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q))); }
  if (!list.length) { g.innerHTML = `<div class="no-result">${lrQuery ? '没有匹配的内容，换个关键词试试 🔍' : '还没有学习记录，点「新建学习记录」写第一篇 ✍️'}</div>`; return; }
  g.innerHTML = list.map(cardHTML).join('');
}
function renderHomeLatest() {
  const list = learningList.slice(0, 4);
  const g = document.getElementById('homeLatest'), head = document.getElementById('homeLatestHead');
  if (!list.length) { if (head) head.style.display = 'none'; g.innerHTML = ''; return; }
  if (head) head.style.display = 'flex';
  g.innerHTML = list.map(cardHTML).join('');
}
async function resyncOne(id) { const d = getLR(); const x = d.find(a => a.id === id); if (!x || !sb) return; let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, files: x.files || [], emoji: x.emoji || '📚' }), 15000); ok = !r.error; } catch (e) { } if (ok) { setLR(d.filter(a => a.id !== id)); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); showToast('已同步到云端 ✓'); } else showToast('同步失败，稍后再试（内容仍安全存在本机）'); }

/* ===== 阅读页 ===== */
function attHTML(files) {
  if (!files || !files.length) return '';
  return `<div class="article-attachments"><h4><i class="fa-solid fa-paperclip"></i>附件 (${files.length})</h4>${files.map(f => `<a class="att-card" href="${esc(f.url)}" target="_blank" download><i class="fa-solid ${fileIcon(f.name)}"></i><span><b>${esc(f.name)}</b><small>${fmtSize(f.size || 0)}</small></span><i class="fa-solid fa-download"></i></a>`).join('')}</div>`;
}
function renderRead(p, preview) {
  const tags = (p.tags || []).map(t => `<span class="mtag">${esc(t)}</span>`).join('');
  const imgs = p.images || [];
  const gallery = imgs.length ? `<div class="article-gallery">${imgs.map(s => `<div class="gal-item" data-img="${esc(s)}"><img src="${esc(s)}" alt="" loading="lazy"></div>`).join('')}</div>` : '';
  const links = p.links || [];
  const refs = links.length ? `<div class="article-refs"><h4><i class="fa-solid fa-link"></i>参考链接</h4>${links.map(l => `<a class="ref-card" href="${esc(l.url)}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i><span><b>${esc(l.text || l.url)}</b><small>${esc(l.url)}</small></span><i class="fa-solid fa-chevron-right"></i></a>`).join('')}</div>` : '';
  const atts = attHTML(p.files);
  let nav = '';
  if (!preview) {
    const idx = learningList.findIndex(a => String(a.id) === String(p.id));
    const newer = idx > 0 ? learningList[idx - 1] : null; const older = idx >= 0 && idx < learningList.length - 1 ? learningList[idx + 1] : null;
    const card = (a, dir, cls) => a ? `<a class="an ${cls}" data-id="${esc(a.id)}"><i class="fa-solid fa-chevron-${dir === 'left' ? 'left' : 'right'}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>${esc(a.title || '无标题')}</b></span></a>` : `<div class="an disabled ${cls}"><i class="fa-solid fa-chevron-${dir === 'left' ? 'left' : 'right'}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>没有了</b></span></div>`;
    nav = `<div class="article-nav">${card(older, 'left', '')}${card(newer, 'right', 'next')}</div>`;
  }
  const localBar = p._local ? `<div class="preview-bar" style="background:rgba(47,111,237,.08);border-color:rgba(47,111,237,.3);color:var(--blue)"><i class="fa-solid fa-floppy-disk"></i>这篇还在本机，联网后会自动同步。<button class="btn btn-ghost" id="syncNow" style="font-size:12px;padding:6px 12px"><i class="fa-solid fa-cloud-arrow-up"></i>立即同步</button></div>` : '';
  const bar = preview ? `<div class="preview-bar"><i class="fa-solid fa-eye"></i>这是预览，尚未发布。<button class="btn btn-ghost" id="backEdit" style="font-size:12px;padding:6px 12px"><i class="fa-solid fa-pen"></i>返回编辑</button></div>` : `<div class="read-bar"><a class="back-link" id="backList"><i class="fa-solid fa-arrow-left"></i>返回学习成长</a><div class="rb-spacer"></div>${p._local ? '' : `<button class="pc-m" id="editCur" title="编辑"><i class="fa-solid fa-pen"></i></button>`}<button class="pc-m pc-m-del" id="delCur" title="删除"><i class="fa-solid fa-trash"></i></button></div>`;
  document.getElementById('readInner').innerHTML = `${bar}${localBar}<article class="article"><h1 class="article-title">${esc(p.title || '无标题')}</h1><div class="article-meta">${fmtDate(p.created_at || new Date().toISOString())}${tags}</div><div class="article-body">${(window.__isHTML && window.__isHTML(p.content)) ? p.content : toRTEHTML(p.content || '')}</div>${gallery}${atts}${refs}</article>${nav}`;
  document.getElementById('readInner').querySelectorAll('.gal-item').forEach(g => g.onclick = () => openLB(g.dataset.img));
  const bl = document.getElementById('backList'); if (bl) bl.onclick = () => go('learning');
  const be = document.getElementById('backEdit'); if (be) be.onclick = () => { showView('edit'); setNav('learning'); };
  const sn = document.getElementById('syncNow'); if (sn) sn.onclick = () => resyncOne(p.id);
  const ec = document.getElementById('editCur'); if (ec) ec.onclick = () => editLearning(p.id);
  const dc = document.getElementById('delCur'); if (dc) dc.onclick = () => deleteLearning(p.id, !!p._local);
  document.getElementById('readInner').querySelectorAll('.an[data-id]').forEach(a => a.onclick = () => go('read/' + a.dataset.id));
}

/* ===== 学习成长：整页编辑器 ===== */
let lrImages = [], lrLinks = [], lrFiles = [];
let editingId = null, editingLocal = false, editReturnTo = 'learning';
function setEditorMode(on) { const pub = document.getElementById('lrPub'); pub.innerHTML = on ? '<i class="fa-solid fa-check"></i> 保存修改' : '<i class="fa-solid fa-rocket"></i> 发布'; document.getElementById('lrEditTitle').innerHTML = on ? '<i class="fa-solid fa-pen"></i> 编辑学习记录' : '<i class="fa-solid fa-pen"></i> 写一篇学习记录'; }
function clearEditor() { editingId = null; editingLocal = false; document.getElementById('lrTitle').value = ''; if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').innerHTML = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; lrFiles = []; renderThumbs(); renderLinkList(); renderFileList(); setEditorMode(false); }
function openLearningEditor() { showView('edit'); setNav('learning'); window.scrollTo(0, 0); }
function editLearning(id) {
  const p = learningList.find(a => String(a.id) === String(id)); if (!p) return;
  editingId = String(id); editingLocal = !!p._local;
  editReturnTo = curHash().startsWith('read/') ? curHash() : 'learning';
  document.getElementById('lrTitle').value = p.title || '';
  if (window.__rte) window.__rte.ed.innerHTML = toRTEHTML(p.content || ''); else document.getElementById('lrContent').innerHTML = toRTEHTML(p.content || '');
  document.getElementById('lrTags').value = (p.tags || []).join(', ');
  lrImages = (p.images || []).slice(); renderThumbs();
  lrLinks = (p.links || []).map(l => ({ text: l.text, url: l.url })); renderLinkList();
  lrFiles = (p.files || []).slice(); renderFileList();
  setEditorMode(true); openLearningEditor();
  setTimeout(() => document.getElementById('lrTitle').focus(), 150);
}
/* 本机小账本 */
const HIDE_KEY = 'chi_lr_hide', EDIT_KEY = 'chi_lr_edit';
const getHide = () => { try { const r = JSON.parse(localStorage.getItem(HIDE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setHide = a => localStorage.setItem(HIDE_KEY, JSON.stringify(a));
const getEdit = () => { try { const r = JSON.parse(localStorage.getItem(EDIT_KEY)); return r && typeof r === 'object' ? r : {}; } catch (e) { return {}; } };
const setEdit = o => localStorage.setItem(EDIT_KEY, JSON.stringify(o));
function applyLocalOverlay(arr) { const hide = getHide(); const ov = getEdit(); return arr.filter(p => !hide.includes(String(p.id))).map(p => { const o = ov[String(p.id)]; if (!o) return p; return Object.assign({}, p, { title: o.title, content: o.content, images: o.images, links: o.links, tags: o.tags }); }); }
async function deleteLearning(id, isLocal) {
  if (!confirm('确定删除这篇文章？此操作不可撤销。')) return;
  const sid = String(id); const isSeed = sid.indexOf('seed-') === 0;
  const targetL = learningList.find(a => String(a.id) === sid);
  const delKeyL = normTxt(targetL ? targetL.title : '');
  const matchLR = x => String(x.id) === sid || (delKeyL !== '' && normTxt(x.title) === delKeyL);
  const ppLR = getPostedLR(); if (ppLR.some(matchLR)) setPostedLR(ppLR.filter(x => !matchLR(x)));
  if (isLocal) { setLR(getLR().filter(x => !matchLR(x))); }
  else if (isSeed) { const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h); }
  else if (sb) {
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').delete().eq('id', sid), 12000); ok = !r.error; } catch (e) { } }
    if (!ok) { const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); if (curHash().startsWith('read/')) go('learning'); showToast('已在本机移除 ✓（云端副本需开删除权限才能彻底抹掉）'); return; }
  } else { const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h); }
  invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest();
  if (curHash().startsWith('read/') || curHash() === 'edit') go('learning');
  showToast('已删除 ✓');
}
function renderThumbs() { document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => { if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb uploading"><i class="fa-solid fa-spinner fa-spin up-spin"></i><span class="up-hint">上传中</span></div>`; return `<div class="lr-thumb"><img src="${esc(s)}" alt="" loading="lazy"><button data-rmimg="${i}">✕</button></div>`; }).join(''); }
function renderLinkList() { document.getElementById('lrLinkList').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><i class="fa-solid fa-link lk"></i><div class="lt">${esc(l.text || l.url)}<small>${esc(l.url)}</small></div><button data-rmlink="${i}"><i class="fa-solid fa-xmark"></i></button></div>`).join(''); }

/* ===== 附件列表渲染（修复版：支持上传中/成功/失败三种状态） ===== */
function renderFileList() { 
  document.getElementById('lrFiles').innerHTML = lrFiles.map((f, i) => {
    if (f && f._uploading) {
      return `<div class="lr-fileitem" style="opacity:.7"><i class="fa-solid fa-spinner fa-spin" style="color:var(--accent)"></i><div class="lf-name"><b>${esc(f.name)}</b><small>上传中…</small></div></div>`;
    }
    if (f && f._error) {
      return `<div class="lr-fileitem" style="border-color:#e5484d;background:rgba(229,72,77,.05)"><i class="fa-solid fa-circle-exclamation" style="color:#e5484d"></i><div class="lf-name"><b>${esc(f.name)}</b><small style="color:#e5484d">${esc(f.errorMsg || '上传失败')}</small></div><button data-retry="${i}" title="重试上传"><i class="fa-solid fa-rotate-right" style="color:var(--accent)"></i></button><button data-rmfile="${i}" title="删除"><i class="fa-solid fa-xmark"></i></button></div>`;
    }
    return `<div class="lr-fileitem"><i class="fa-solid ${fileIcon(f.name)}"></i><div class="lf-name"><b>${esc(f.name)}</b><small>${fmtSize(f.size || 0)}</small></div><a class="lf-view" href="${esc(f.url)}" target="_blank" download>查看</a><button data-rmfile="${i}"><i class="fa-solid fa-xmark"></i></button></div>`;
  }).join(''); 
}

document.getElementById('lrFile').addEventListener('change', async e => { 
  const files = [...e.target.files]; 
  for (const f of files) { 
    if (!f.type.startsWith('image/')) continue; 
    await processImageUpload(f, lrImages, renderThumbs); 
  } 
  e.target.value = ''; 
});

document.getElementById('lrThumbs').addEventListener('click', e => { 
  const b = e.target.closest('[data-rmimg]'); 
  if (b) { lrImages.splice(+b.dataset.rmimg, 1); renderThumbs(); } 
});

/* ===== 附件上传事件（修复版） ===== */
document.getElementById('lrDoc').addEventListener('change', async e => {
  const files = [...e.target.files]; 
  e.target.value = '';
  for (const f of files) {
    if (f.size > ATT_MAX) { showToast('「' + esc(f.name) + '」超过 20MB，已跳过'); continue; }
    const ph = { _uploading: true, name: f.name, size: f.size, file: f }; 
    lrFiles.push(ph); 
    renderFileList();
    try {
      const url = await uploadAttachment(f);
      Object.assign(ph, { _uploading: false, _error: false, url, errorMsg: '' });
      showToast('附件「' + esc(f.name) + '」上传成功 ✓');
    } catch (err) {
      Object.assign(ph, { _uploading: false, _error: true, errorMsg: err.message || '上传失败' });
      showToast('附件上传失败：' + esc(err.message || '网络或权限问题'), 6000);
    }
    renderFileList();
  }
});

/* ===== 附件列表点击事件（支持重试和删除） ===== */
document.getElementById('lrFiles').addEventListener('click', e => {
  const retryBtn = e.target.closest('[data-retry]');
  if (retryBtn) {
    const idx = +retryBtn.dataset.retry;
    const f = lrFiles[idx];
    if (f && f.file) {
      retryAttachmentUpload(idx, f.file);
    }
    return;
  }
  const b = e.target.closest('[data-rmfile]'); 
  if (b) { lrFiles.splice(+b.dataset.rmfile, 1); renderFileList(); } 
});

document.getElementById('lrAddLink').addEventListener('click', () => { 
  const t = document.getElementById('lrLinkText'), u = document.getElementById('lrLinkUrl'); 
  const url = u.value.trim(); 
  if (!url) { u.focus(); return; } 
  lrLinks.push({ text: t.value.trim() || url, url }); 
  t.value = ''; u.value = ''; 
  renderLinkList(); 
});

document.getElementById('lrLinkList').addEventListener('click', e => { 
  const b = e.target.closest('[data-rmlink]'); 
  if (b) { lrLinks.splice(+b.dataset.rmlink, 1); renderLinkList(); } 
});

function gatherPost() { 
  return { 
    title: document.getElementById('lrTitle').value.trim(), 
    content: window.__rte ? window.__rte.ed.innerHTML : document.getElementById('lrContent').innerHTML, 
    images: lrImages.filter(s => typeof s === 'string'), 
    links: lrLinks.slice(), 
    files: lrFiles.filter(f => f && f.url && !f._uploading && !f._error), 
    tags: document.getElementById('lrTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean) 
  }; 
}

document.getElementById('lrBack').addEventListener('click', () => go(editReturnTo || 'learning'));
document.getElementById('lrNewBtn').addEventListener('click', () => { clearEditor(); editReturnTo = 'learning'; openLearningEditor(); setTimeout(() => document.getElementById('lrTitle').focus(), 150); });
document.getElementById('lrPreview').addEventListener('click', () => { 
  const p = gatherPost(); 
  if (!p.title && !p.content) { showToast('先写点标题或正文再预览'); return; } 
  renderRead({ ...p, created_at: new Date().toISOString(), emoji: '👀' }, true); 
  showView('read'); 
  setNav('learning'); 
});
document.getElementById('lrPub').addEventListener('click', publishLearning);
async function publishLearning() {
  /* 检查附件状态 */
  const pendingFiles = lrFiles.filter(f => f._uploading);
  const errorFiles = lrFiles.filter(f => f._error);
  if (pendingFiles.length) { showToast(`还有 ${pendingFiles.length} 个附件正在上传，请稍等...`, 4000); return; }
  if (errorFiles.length) { showToast(`${errorFiles.length} 个附件上传失败，请删除或点击重试后再发布`, 5000); return; }

  if (editingId) {
    const p = gatherPost();
    if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
    const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中…';
    const sid = String(editingId); const isSeed = sid.indexOf('seed-') === 0;
    let ok = false;
    const ppLR = getPostedLR(); const piLR = ppLR.findIndex(a => String(a.id) === sid);
    if (piLR >= 0) { ppLR[piLR] = Object.assign({}, ppLR[piLR], { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, files: p.files }); setPostedLR(ppLR); ok = true; }
    if (editingLocal) {
      const d = getLR(); const idx = d.findIndex(a => a.id === sid);
      if (idx >= 0) { d[idx] = Object.assign({}, d[idx], { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, files: p.files }); setLR(d); ok = true; }
    } else if (isSeed) {
      const ov = getEdit(); ov[sid] = { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags }; setEdit(ov); ok = true;
    } else if (sb) {
      for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').update({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, files: p.files, emoji: '📚' }).eq('id', sid), 20000); ok = !r.error; } catch (e) { } }
    }
    btn.disabled = false;
    if (ok) { const dest = editReturnTo || 'learning'; clearEditor(); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); go(dest); showToast('已保存修改 ✓'); return; }
    btn.innerHTML = '<i class="fa-solid fa-check"></i> 保存修改'; showToast('保存失败 · 原内容未丢失'); return;
  }
  const p = gatherPost(); 
  if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
  const dup = learningList.find(a => normTxt(a.title) === normTxt(p.title));
  if (dup) { showToast('已有同标题《' + esc(p.title) + '》，请直接编辑它，避免重复', 5200); return; }
  const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 发布中…';
  let ok = false; 
  if (sb && navigator.onLine) { 
    for (let i = 0; i < 2 && !ok; i++) { 
      try { 
        const res = await withTimeout(sb.from('learning').insert({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, files: p.files, emoji: '📚' }), 20000); 
        ok = !res.error; 
      } catch (e) { } 
    } 
  }
  btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rocket"></i> 发布';
  document.getElementById('lrTitle').value = ''; 
  if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').innerHTML = ''; 
  document.getElementById('lrTags').value = ''; 
  lrImages = []; lrLinks = []; lrFiles = []; 
  renderThumbs(); renderLinkList(); renderFileList();
  if (ok) {
    const pool = getPostedLR(); pool.unshift({ id: uid('LR'), ...p, emoji: '📚', created_at: new Date().toISOString() }); setPostedLR(pool); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); go('learning'); showToast('已发布 ✓ 同步到云端'); return;
  }
  const d = getLR(); d.unshift({ id: uid('LR'), ...p, emoji: '📚', created_at: new Date().toISOString(), _local: true }); setLR(d);
  invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); go('learning');
  showToast('已保存到本机 ✓ 联网后自动同步，内容不会丢', 6000);
}

/* ===== 生活随笔 ===== */
const postList = document.getElementById('postList'), postInput = document.getElementById('postInput'), postTags = document.getElementById('postTags'), postPub = document.getElementById('postPub');
const PUB_HTML = postPub ? postPub.innerHTML : '<i class="fa-solid fa-rocket"></i> 发布';
const SAVE_HTML = '<i class="fa-solid fa-check"></i> 保存修改';
const seenIds = new Set(), LKEY = 'chi_posts_local_v1'; let cloudOK = true, lifeImages = [], lifeList = [];
let lifeEditId = null, lifeEditLocal = false;
const SEED_LIFE = [{ id: 'sl1', content: '今天把进销存看板的"该补货吗"挪到了第一屏。看板的第一屏只该回答一个问题。', tags: ['复盘'], images: [], created_at: '2026-07-20T21:30:00Z' }, { id: 'sl2', content: '周末给草缸换了水，顺便把网球拍线也换了。生活和分析一样，定期维护才不会崩。🎾', tags: ['生活'], images: [], created_at: '2026-07-13T18:00:00Z' }];
function loadLocal() { try { const r = JSON.parse(localStorage.getItem(LKEY)); if (Array.isArray(r)) return r; } catch (e) { } return []; }
function saveLocal(p) { localStorage.setItem(LKEY, JSON.stringify(p)); }
function setSubText(on) { const el = document.getElementById('postSubText'); if (el) el.innerHTML = '分析之外的日常碎片。像发朋友圈一样记录生活——短小、即时、带图。'; }
function postHTML(p) {
  let raw = contentOf(p);
  const isH = window.__isHTML && window.__isHTML(raw);
  let imgs = (p.images || []).slice();
  let txtHtml, ptxtCls;
  if (isH) {
    ptxtCls = 'ptxt ptxt-html';
    try {
      const doc = new DOMParser().parseFromString('<div class="__rtx">' + raw + '</div>', 'text/html');
      const root = doc.querySelector('.__rtx');
      if (root) { root.querySelectorAll('img').forEach(im => { const s = im.getAttribute('src') || im.getAttribute('data-src'); if (s) imgs.push(s); im.remove(); }); txtHtml = root.innerHTML; } else txtHtml = raw;
    } catch (e) { txtHtml = raw; }
  } else { ptxtCls = 'ptxt'; txtHtml = toRTEHTML(raw); }
  imgs = imgs.filter((s, i) => s && imgs.indexOf(s) === i);
  const ts = p.created_at ? new Date(p.created_at).getTime() : (p.ts || Date.now());
  const tags = (p.tags || []).map(t => `#${esc(t)}`).join('');
  let imgHtml = '';
  if (imgs.length) {
    const cols = imgs.length >= 3 ? 3 : imgs.length;
    imgHtml = `<div class="life-grid lg-c${cols}">${imgs.map(s => `<div class="lg-cell"><img class="limg" src="${esc(s)}" data-img="${esc(s)}" alt="" loading="lazy"></div>`).join('')}</div>`;
  }
  const mgmt = `<div class="life-mgmt">${p._local ? `<button class="pc-m sync-btn" data-sync="${esc(p.id)}" title="同步"><i class="fa-solid fa-cloud-arrow-up"></i></button>` : ''}<button class="pc-m" data-life-edit="${esc(p.id)}" title="编辑"><i class="fa-solid fa-pen"></i></button><button class="pc-m pc-m-del" data-life-del="${esc(p.id)}" data-local="${p._local ? '1' : '0'}" title="删除"><i class="fa-solid fa-trash"></i></button></div>`;
  return `<div class="post reveal" data-id="${esc(p.id)}"><div class="ph"><div class="pav">历</div><div class="pinfo"><div class="who">阿历</div><div class="when">${relTime(ts)}</div></div>${mgmt}</div><div class="${ptxtCls}">${txtHtml}</div>${imgHtml}${tags ? `<div class="ptags">${tags}</div>` : ''}</div>`;
}
function renderPosts(arr, showOffline) {
  if (!arr.length) { postList.innerHTML = '<div class="no-result">还没有生活随笔，写第一条吧 ✍️</div>'; return; }
  postList.innerHTML = arr.map(postHTML).join('');
  if (showOffline) showToast('当前离线，显示本机内容', 3000);
}
async function loadPosts() {
  if (!sb) { cloudOK = false; return; }
  try {
    const res = await withTimeout(sb.from('life').select('*').order('created_at', { ascending: false }).limit(200), 6000);
    if (res.error) { cloudOK = false; return; }
    const data = res.data || [];
    const local = loadLocal();
    if (local.length) {
      const remain = [];
      for (const x of local) {
        let ok = false;
        try { const r = await withTimeout(sb.from('life').insert({ content: x.content, images: x.images, tags: x.tags }), 15000); ok = !r.error; } catch (e) { }
        if (!ok) remain.push(x);
      }
      saveLocal(remain);
    }
    const hide = getLifeHide();
    const sets = lifeHideSets();
    lifeList = sortPosts([...SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })), ...data.map(x => ({ ...x, _cloud: true })), ...loadLocal().map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]);
    lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets));
    cloudOK = true;
  } catch (e) { cloudOK = false; }
}
async function deleteLife(id, isLocal) {
  if (!confirm('确定删除这条随笔？')) return;
  const sid = String(id); const isSeed = sid.indexOf('sl') === 0;
  const target = lifeList.find(a => String(a.id) === sid);
  const delKey = normTxt(target ? target.content : '');
  const match = x => String(x.id) === sid || (delKey !== '' && normTxt(x.content) === delKey);
  const pp = getPostedLife(); if (pp.some(match)) setPostedLife(pp.filter(x => !match(x)));
  if (isLocal) { saveLocal(loadLocal().filter(x => !match(x))); }
  else if (isSeed) { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); addLifeHideC(delKey); }
  else if (sb) {
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('life').delete().eq('id', sid), 12000); ok = !r.error; } catch (e) { } }
    if (!ok) { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); addLifeHideC(delKey); }
  } else { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); addLifeHideC(delKey); }
  await loadPosts(); if (curHash() === 'life') renderPosts(lifeList, !cloudOK);
  showToast('已删除 ✓');
}
function editLife(id) {
  const p = lifeList.find(a => String(a.id) === String(id)); if (!p) return;
  lifeEditId = String(id); lifeEditLocal = !!p._local;
  postInput.value = contentOf(p) || '';
  postTags.value = (p.tags || []).join(', ');
  lifeImages = (p.images || []).slice();
  renderLifeThumbs();
  postPub.innerHTML = SAVE_HTML;
  setSubText(true);
  postInput.focus();
}
function renderLifeThumbs() { 
  const el = document.getElementById('lifeThumbs'); 
  if (!el) return;
  el.innerHTML = lifeImages.map((s, i) => `<div class="lr-thumb"><img src="${esc(s)}" alt="" loading="lazy"><button data-rmlifeimg="${i}">✕</button></div>`).join(''); 
}
const lifeFileEl = document.getElementById('lifeFile');
if (lifeFileEl) {
  lifeFileEl.addEventListener('change', async e => { 
    const files = [...e.target.files]; 
    for (const f of files) { 
      if (!f.type.startsWith('image/')) continue; 
      await processImageUpload(f, lifeImages, renderLifeThumbs); 
    } 
    e.target.value = ''; 
  });
}
const lifeThumbsEl = document.getElementById('lifeThumbs');
if (lifeThumbsEl) {
  lifeThumbsEl.addEventListener('click', e => { 
    const b = e.target.closest('[data-rmlifeimg]'); 
    if (b) { lifeImages.splice(+b.dataset.rmlifeimg, 1); renderLifeThumbs(); } 
  });
}
if (postPub) {
  postPub.addEventListener('click', async () => {
    const txt = postInput.value.trim(); 
    if (!txt && !lifeImages.length) { showToast('写点什么或配张图吧'); return; }
    const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    if (lifeEditId) {
      const sid = String(lifeEditId); 
      const isSeed = sid.indexOf('sl') === 0;
      const pp = getPostedLife(); const pi = pp.findIndex(a => String(a.id) === sid);
      if (pi >= 0) { pp[pi] = Object.assign({}, pp[pi], { content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags }); setPostedLife(pp); }
      if (lifeEditLocal) { const d = loadLocal(); const idx = d.findIndex(a => a.id === sid); if (idx >= 0) { d[idx] = Object.assign({}, d[idx], { content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags }); saveLocal(d); } }
      else if (isSeed) { /* seed 不支持编辑 */ }
      else if (sb) { 
        for (let i = 0; i < 2; i++) { 
          try { 
            await withTimeout(sb.from('life').update({ content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags }).eq('id', sid), 12000); 
            break; 
          } catch (e) { } 
        } 
      }
      lifeEditId = null; lifeEditLocal = false; 
      postInput.value = ''; 
      postTags.value = ''; 
      lifeImages = []; 
      renderLifeThumbs(); 
      postPub.innerHTML = PUB_HTML; 
      setSubText(false);
      await loadPosts(); 
      if (curHash() === 'life') renderPosts(lifeList, !cloudOK); 
      showToast('已保存修改 ✓'); 
      return;
    }
    let ok = false; 
    if (sb && navigator.onLine) { 
      try { 
        const r = await withTimeout(sb.from('life').insert({ content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags }), 15000); 
        ok = !r.error; 
      } catch (e) { } 
    }
    if (ok) {
      const pool = getPostedLife(); pool.unshift({ id: uid('LF'), content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags, created_at: new Date().toISOString() }); setPostedLife(pool);
    } else {
      const d = loadLocal(); d.unshift({ id: uid('LF'), content: txt, images: lifeImages.filter(s => typeof s === 'string'), tags, ts: Date.now(), _local: true }); saveLocal(d);
    }
    postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs();
    await loadPosts(); if (curHash() === 'life') renderPosts(lifeList, !cloudOK);
    showToast(ok ? '已发布 ✓' : '已保存到本机 ✓', 4000);
  });
}

/* ===== 日历 ===== */
function renderCal() {
  const el = document.getElementById('calendarWidget');
  if (!el) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let html = `<div class="cal-head"><button onclick="changeCal(-1)">‹</button><b>${y}年${m+1}月</b><button onclick="changeCal(1)">›</button></div>`;
  html += `<div class="cal-grid"><div class="cal-w">日</div><div class="cal-w">一</div><div class="cal-w">二</div><div class="cal-w">三</div><div class="cal-w">四</div><div class="cal-w">五</div><div class="cal-w">六</div>`;
  for (let i = 0; i < first; i++) html += `<div></div>`;
  for (let d = 1; d <= days; d++) {
    const isToday = d === now.getDate();
    html += `<div class="cal-d ${isToday ? 'today' : ''}"><span class="cd-num">${d}</span></div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}
function changeCal(delta) { /* 简化版，仅显示当前月 */ renderCal(); }

/* ===== 统计 / 标签云 ===== */
function renderStats() {
  const el = document.getElementById('statWidget');
  if (!el) return;
  const lrCount = learningList.length;
  const lifeCount = lifeList.length;
  el.innerHTML = `
    <div class="stat-row"><div class="si" style="background:var(--accent-soft);color:var(--accent)">📚</div><span class="sl-t">学习记录</span><b>${lrCount}</b></div>
    <div class="stat-row"><div class="si" style="background:rgba(47,111,237,.1);color:var(--blue)">🌿</div><span class="sl-t">生活随笔</span><b>${lifeCount}</b></div>
  `;
}
function renderTagCloud() {
  const el = document.getElementById('tagCloudWidget');
  if (!el) return;
  const map = new Map();
  learningList.forEach(p => (p.tags || []).forEach(t => map.set(t, (map.get(t) || 0) + 1)));
  const arr = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  el.innerHTML = arr.map(([t, n]) => `<span class="tagchip" onclick="searchTag('${esc(t)}')">${esc(t)} <small>${n}</small></span>`).join('');
}
function searchTag(t) { go('learning'); lrQuery = t; renderLearningList(); }

/* ===== 首页生活随笔 ===== */
function renderHomeLife() {
  const g = document.getElementById('homeLife');
  if (!g) return;
  const list = lifeList.slice(0, 3);
  if (!list.length) { g.innerHTML = ''; return; }
  g.innerHTML = list.map(postHTML).join('');
}

/* ===== 主题切换 ===== */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('chi_theme', isDark ? 'light' : 'dark');
}
const savedTheme = localStorage.getItem('chi_theme');
if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

/* ===== 时间 / 干支 ===== */
function updateTime() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${String(now.getMonth()+1).padStart(2,'0')}月${String(now.getDate()).padStart(2,'0')}日 星期${['日','一','二','三','四','五','六'][now.getDay()]}`;
  const clockStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dEl = document.getElementById('dateDisplay');
  const cEl = document.getElementById('clockDisplay');
  if (dEl) dEl.innerHTML = `<b>${dateStr}</b>`;
  if (cEl) cEl.textContent = clockStr;
}
setInterval(updateTime, 1000);
updateTime();

/* ===== 搜索 ===== */
const homeSearch = document.getElementById('homeSearch');
if (homeSearch) {
  homeSearch.addEventListener('input', e => {
    const q = e.target.value.trim();
    if (!q) return;
    lrQuery = q;
    go('learning');
    renderLearningList();
  });
}
const lrSearch = document.getElementById('lrSearch');
if (lrSearch) {
  lrSearch.addEventListener('input', e => {
    lrQuery = e.target.value.trim();
    renderLearningList();
  });
}

/* ===== 回到顶部 ===== */
window.addEventListener('scroll', () => {
  const btn = document.getElementById('toTop');
  if (btn) btn.classList.toggle('show', window.scrollY > 400);
});

/* ===== 富文本编辑器初始化 ===== */
const rteEl = document.getElementById('lrContent');
if (rteEl) {
  const bar = document.getElementById('rteBar');
  if (bar) {
    bar.addEventListener('click', e => {
      const b = e.target.closest('.rte-b');
      if (!b) return;
      e.preventDefault();
      const cmd = b.dataset.cmd;
      const val = b.dataset.val;
      if (cmd === 'createLink') {
        const url = prompt('输入链接地址:', 'https://');
        if (url) document.execCommand(cmd, false, url);
      } else if (cmd === 'formatBlock') {
        document.execCommand(cmd, false, val);
      } else {
        document.execCommand(cmd, false, null);
      }
      rteEl.focus();
    });
  }
  window.__rte = {
    ed: rteEl,
    clear: () => { rteEl.innerHTML = ''; }
  };
}

/* ===== 弹层 ===== */
function showQR(img, title) {
  const modal = document.getElementById('qrModal');
  const card = document.getElementById('qrCard');
  const imgEl = document.getElementById('qrImg');
  const titleEl = document.getElementById('qrTitle');
  if (titleEl) titleEl.textContent = '扫码添加' + (title ? ' ' + title : '');
  if (imgEl) { imgEl.src = img; imgEl.onload = () => card.classList.remove('no-img'); imgEl.onerror = () => card.classList.add('no-img'); }
  modal.classList.add('open');
  lockScroll(true);
}
function closeQR() { document.getElementById('qrModal').classList.remove('open'); lockScroll(false); }
function closePDF() { document.getElementById('pdfModal').classList.remove('open'); lockScroll(false); }

/* ===== 自动保存草稿 ===== */
let autoSaveTimer = null;
function setupAutoSave() {
  const inputs = [document.getElementById('lrTitle'), document.getElementById('lrContent'), document.getElementById('lrTags')];
  inputs.forEach(el => {
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        const draft = gatherPost();
        if (draft.title || draft.content) {
          localStorage.setItem('chi_lr_auto_draft', JSON.stringify({...draft, savedAt: Date.now()}));
        }
      }, 3000);
    });
  });
}
setupAutoSave();

/* ===== 快捷键 ===== */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    const activeView = document.querySelector('.view.active');
    if (activeView && activeView.dataset.view === 'edit') {
      publishLearning();
    }
  }
});

/* ===== 网络状态监听 ===== */
window.addEventListener('online', () => showToast('网络已恢复 ✓', 3000));
window.addEventListener('offline', () => showToast('网络已断开，内容会保存到本机', 4000));

/* ===== 初始化 ===== */
window.addEventListener('hashchange', route);
renderCases();
renderCerts();
route();
