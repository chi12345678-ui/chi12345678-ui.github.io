/* =====================================================================
   阿历的数字花园 · app.js（v20260806b 整页编辑器版）
   ① 学习记录去重 ② 附件真实上传 ③ 搜索可用 ④ 整页编辑器（非弹窗）
   ⑤ 干支时辰+农历 ⑥ 首页日历/分类汇总/标签云 ⑦ 朋友圈九宫格
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
  try { if (sb) { arr[idx] = await uploadImageToStorage(file); } else { arr[idx] = await compress(file); } }
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

/* ===== 附件上传 ===== */
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
  if (!sb) throw new Error('云端未连接');
  if (file.size > ATT_MAX) throw new Error('超过20MB');
  const safe = (file.name || 'file').replace(/[^\w.\-一-龥]+/g, '_');
  const path = `files/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
  const { error } = await sb.storage.from(ATT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return sb.storage.from(ATT_BUCKET).getPublicUrl(path).data.publicUrl;
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
  const pc = e.target.closest('.postcard'); if (pc) { e.preventDefault(); go('read/' + encodeURIComponent(pc.dataset.id)); return; }
  const a = e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute('href').slice(1)); }
});

/* ===== 项目案例 ===== */
const CASES = [
  { color: 'linear-gradient(135deg,#e8730c,#ff9d4d)', icon: 'fa-layer-group', tag: 'USER VALUE', title: 'RFM 用户价值分析案例', desc: '基于 SQL 取数 + Python(Pandas) 构建 RFM 模型，对线上平台用户做三维度打分与分层，输出可复现的交互式分析报告。', tech: ['SQL', 'Python', 'Pandas', 'Jupyter'], docs: [{ label: '交互式报告', href: '线上平台用户RFM分析.html' }], dl: '线上平台用户RFM分析.ipynb' },
  { color: 'linear-gradient(135deg,#2f6fed,#5b8def)', icon: 'fa-boxes-stacked', tag: 'INVENTORY', title: '快消品进销存分析', desc: '以 Power BI 完成数据建模与清洗，搭建进销存看板 + 分析报告：监控库存、月销与临期风险，完成 ABC 动销与智能补货诊断。', tech: ['Power BI', 'DAX'], docs: [{ label: '演示案例', href: '快消品进销存演示案例.pdf' }, { label: '分析报告', href: '快消品进销存案例分析报告.pdf' }], dl: '快消品进销存演示案例.pbix' },
  { color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: 'fa-rotate', tag: 'RETENTION · LTV', title: '复购与留存分析', desc: '复购专题双报告：销售趋势、留存、新增/复购拆解，以及母婴店铺「黄金60天」转化归因，核心度量以 DAX 实现。', tech: ['Power BI', 'DAX', '归因分析'], docs: [{ label: '演示案例', href: '复购分析案例.pdf' }, { label: '分析报告', href: '复购案例分析.pdf' }], dl: '复购分析案例.pbix' }
];
function caseHTML(c, i) {
  return `<article class="case case--row"><div class="case-cover" style="background:${c.color}" data-doc0="${esc((c.docs[0] || {}).href || '')}"><span class="big">${String(i + 1).padStart(2, '0')}</span><i class="ci fas ${c.icon}"></i><span class="ctag">${c.tag}</span></div><div class="case-body"><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><div class="case-docs">${c.docs.map(d => `<a class="case-doc" href="${esc(d.href)}" target="_blank" rel="noopener"><i class="fas fa-file-lines"></i> ${esc(d.label)}</a>`).join('')}</div><div class="case-foot"><div class="case-tech">${c.tech.map(t => `<span>${esc(t)}</span>`).join('')}</div><a class="case-dl" href="${esc(c.dl)}" download><i class="fas fa-download"></i> 源文件</a></div></div></article>`;
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
function renderCerts() { document.getElementById('certGrid').innerHTML = CERTS.map(c => `<div class="cert" data-img="${esc(c.img)}"><div class="thumb"><img src="${esc(c.img)}" alt="${esc(c.n)}" loading="lazy" onerror="this.style.display='none'"><div class="zoom"><i class="fas fa-magnifying-glass-plus"></i>查看大图</div></div><div class="cn">${esc(c.n)}<small>${esc(c.s)}</small></div></div>`).join(''); }
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
  const fileFlag = (p.files && p.files.length) ? `<span class="file-flag"><i class="fas fa-paperclip"></i>${p.files.length}</span>` : '';
  const mgmt = `<div class="pc-mgmt"><button class="pc-m" data-edit="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-del="${esc(p.id)}" data-local="${p._local ? 1 : 0}" title="删除"><i class="fas fa-trash"></i></button>${p._local ? `<button class="pc-m sync-btn" data-sync="${esc(p.id)}" title="同步云端"><i class="fas fa-rotate"></i></button>` : ''}</div>`;
  return `<article class="postcard postcard--row" data-id="${esc(p.id)}"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '📚'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>${pinned}${localFlag}${fileFlag}</div><h3 class="pc-title">${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p><div class="pc-tags">${tags}</div></div>${mgmt}</article>`;
}
let lrQuery = '';
function renderLearningList() {
  const g = document.getElementById('learningGrid');
  let list = learningList;
  if (lrQuery) { const q = lrQuery.toLowerCase(); list = list.filter(p => (p.title || '').toLowerCase().includes(q) || plainOf(p).toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q))); }
  if (!list.length) { g.innerHTML = '<div class="no-result">' + (lrQuery ? '没有匹配的内容，换个关键词试试 🔍' : '还没有学习记录，点「新建学习记录」写第一篇 ✍️') + '</div>'; return; }
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
  return `<div class="article-attachments"><h4><i class="fas fa-paperclip"></i> 附件下载</h4>${files.map(f => `<a class="att-card" href="${esc(f.url)}" target="_blank" rel="noopener" download="${esc(f.name)}"><i class="fas ${fileIcon(f.name)}"></i><span><b>${esc(f.name)}</b><small>${f.size ? fmtSize(f.size) : '附件'}</small></span><i class="fas fa-download"></i></a>`).join('')}</div>`;
}
function renderRead(p, preview) {
  const tags = (p.tags || []).map(t => `<span class="mtag">${esc(t)}</span>`).join('');
  const imgs = p.images || [];
  const gallery = imgs.length ? `<div class="article-gallery">${imgs.map(s => `<div class="gal-item" data-img="${s}"><img src="${s}" alt=""></div>`).join('')}</div>` : '';
  const links = p.links || [];
  const refs = links.length ? `<div class="article-refs"><h4><i class="fas fa-link"></i> 参考链接</h4>${links.map(l => `<a class="ref-card" href="${esc(l.url)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i><span><b>${esc(l.text || l.url)}</b><small>${esc(l.url)}</small></span><i class="fas fa-external-link-alt"></i></a>`).join('')}</div>` : '';
  const atts = attHTML(p.files);
  let nav = '';
  if (!preview) {
    const idx = learningList.findIndex(a => String(a.id) === String(p.id));
    const newer = idx > 0 ? learningList[idx - 1] : null; const older = idx >= 0 && idx < learningList.length - 1 ? learningList[idx + 1] : null;
    const card = (a, dir, cls) => a ? `<div class="an ${cls}" data-id="${esc(a.id)}"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>${esc(a.title || '无标题')}</b></span></div>` : `<div class="an disabled"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>没有了</b></span></div>`;
    nav = `<div class="article-nav">${card(older, 'left', '')}${card(newer, 'right', 'next')}</div>`;
  }
  const localBar = p._local ? `<div class="preview-bar"><i class="fas fa-hard-drive"></i> 这篇还在本机，联网后会自动同步。<button class="btn btn-ghost" id="syncNow" style="padding:7px 14px"><i class="fas fa-rotate"></i> 立即同步</button></div>` : '';
  const bar = preview ? `<div class="preview-bar"><i class="fas fa-eye"></i> 这是预览，尚未发布。<span class="back-link" id="backEdit" style="margin:0"><i class="fas fa-pen"></i> 返回编辑</span></div>` : `<div class="read-bar"><span class="back-link" id="backList"><i class="fas fa-arrow-left"></i> 返回学习成长</span><span class="rb-spacer"></span><button class="btn btn-ghost rb-btn" id="editCur"><i class="fas fa-pen"></i> 编辑</button><button class="btn btn-ghost rb-btn rb-del" id="delCur"><i class="fas fa-trash"></i> 删除</button></div>`;
  document.getElementById('readInner').innerHTML = `${bar}${localBar}<article class="article"><h1 class="article-title">${esc(p.title || '无标题')}</h1><div class="article-meta"><span>${fmtDate(p.created_at || new Date().toISOString())}</span>${tags}</div><div class="article-body">${(window.__isHTML && window.__isHTML(p.content)) ? p.content : toRTEHTML(p.content || '')}</div>${gallery}${atts}${refs}${nav}</article>`;
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
function setEditorMode(on) { const pub = document.getElementById('lrPub'); pub.innerHTML = on ? '<i class="fas fa-floppy-disk"></i> 保存修改' : '<i class="fas fa-paper-plane"></i> 发布'; document.getElementById('lrEditTitle').innerHTML = on ? '<i class="fas fa-pen"></i> 编辑学习记录' : '<i class="fas fa-pen-nib"></i> 写一篇学习记录'; }
function clearEditor() { editingId = null; editingLocal = false; document.getElementById('lrTitle').value = ''; if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; lrFiles = []; renderThumbs(); renderLinkList(); renderFileList(); setEditorMode(false); }
function openLearningEditor() { showView('edit'); setNav('learning'); window.scrollTo(0, 0); }
function editLearning(id) {
  const p = learningList.find(a => String(a.id) === String(id)); if (!p) return;
  editingId = String(id); editingLocal = !!p._local;
  editReturnTo = curHash().startsWith('read/') ? curHash() : 'learning';
  document.getElementById('lrTitle').value = p.title || '';
  if (window.__rte) window.__rte.ed.innerHTML = toRTEHTML(p.content || ''); else document.getElementById('lrContent').value = p.content || '';
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
function renderThumbs() { document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => { if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb uploading"><div class="up-spin"><i class="fas fa-spinner fa-spin"></i></div><span class="up-hint">上传中</span></div>`; return `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmimg="${i}">&times;</button></div>`; }).join(''); }
function renderLinkList() { document.getElementById('lrLinkList').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><i class="lk fas fa-link"></i><span class="lt">${esc(l.text || l.url)}<small>${esc(l.url)}</small></span><button data-rmlink="${i}"><i class="fas fa-times"></i></button></div>`).join(''); }
function renderFileList() { document.getElementById('lrFiles').innerHTML = lrFiles.map((f, i) => { if (f && f._uploading) return `<div class="lr-fileitem"><i class="fas fa-spinner fa-spin"></i><span class="lf-name">${esc(f.name)}<small>上传中…</small></span></div>`; return `<div class="lr-fileitem"><i class="fas ${fileIcon(f.name)}"></i><span class="lf-name">${esc(f.name)}<small>${fmtSize(f.size || 0)}</small></span><a class="lf-view" href="${esc(f.url)}" target="_blank" rel="noopener">查看</a><button data-rmfile="${i}"><i class="fas fa-times"></i></button></div>`; }).join(''); }
document.getElementById('lrFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; await processImageUpload(f, lrImages, renderThumbs); } e.target.value = ''; });
document.getElementById('lrThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmimg]'); if (b) { lrImages.splice(+b.dataset.rmimg, 1); renderThumbs(); } });
document.getElementById('lrDoc').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = '';
  for (const f of files) {
    if (f.size > ATT_MAX) { showToast('「' + esc(f.name) + '」超过 20MB，已跳过'); continue; }
    const ph = { _uploading: true, name: f.name, size: f.size }; lrFiles.push(ph); renderFileList();
    try {
      const url = await uploadAttachment(f);
      lrFiles[lrFiles.indexOf(ph)] = { name: f.name, size: f.size, url };
      showToast('附件「' + esc(f.name) + '」上传成功 ✓');
    } catch (err) {
      lrFiles.splice(lrFiles.indexOf(ph), 1);
      showToast('附件上传失败：' + esc(err.message || '网络或权限问题') + '（请先在 Supabase 运行 fix.sql）', 6000);
    }
    renderFileList();
  }
});
document.getElementById('lrFiles').addEventListener('click', e => { const b = e.target.closest('[data-rmfile]'); if (b) { lrFiles.splice(+b.dataset.rmfile, 1); renderFileList(); } });
document.getElementById('lrAddLink').addEventListener('click', () => { const t = document.getElementById('lrLinkText'), u = document.getElementById('lrLinkUrl'); const url = u.value.trim(); if (!url) { u.focus(); return; } lrLinks.push({ text: t.value.trim() || url, url }); t.value = ''; u.value = ''; renderLinkList(); });
document.getElementById('lrLinkList').addEventListener('click', e => { const b = e.target.closest('[data-rmlink]'); if (b) { lrLinks.splice(+b.dataset.rmlink, 1); renderLinkList(); } });
function gatherPost() { return { title: document.getElementById('lrTitle').value.trim(), content: document.getElementById('lrContent').value.trim(), images: lrImages.filter(s => typeof s === 'string'), links: lrLinks.slice(), files: lrFiles.filter(f => f && f.url), tags: document.getElementById('lrTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean) }; }
document.getElementById('lrBack').addEventListener('click', () => go(editReturnTo || 'learning'));
document.getElementById('lrNewBtn').addEventListener('click', () => { clearEditor(); editReturnTo = 'learning'; openLearningEditor(); setTimeout(() => document.getElementById('lrTitle').focus(), 150); });
document.getElementById('lrPreview').addEventListener('click', () => { const p = gatherPost(); if (!p.title && !p.content) { showToast('先写点标题或正文再预览'); return; } renderRead({ ...p, created_at: new Date().toISOString(), emoji: '👀' }, true); showView('read'); setNav('learning'); });
document.getElementById('lrPub').addEventListener('click', publishLearning);
async function publishLearning() {
  if (editingId) {
    const p = gatherPost();
    if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
    const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中…';
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
    btn.innerHTML = '<i class="fas fa-floppy-disk"></i> 保存修改'; showToast('保存失败 · 原内容未丢失'); return;
  }
  const p = gatherPost(); if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
  const dup = learningList.find(a => normTxt(a.title) === normTxt(p.title));
  if (dup) { showToast('已有同标题《' + esc(p.title) + '》，请直接编辑它，避免重复', 5200); return; }
  const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发布中…';
  let ok = false; if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('learning').insert({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, files: p.files, emoji: '📚' }), 20000); ok = !res.error; } catch (e) { } } }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布';
  document.getElementById('lrTitle').value = ''; if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; lrFiles = []; renderThumbs(); renderLinkList(); renderFileList();
  if (ok) {
    const pool = getPostedLR(); pool.unshift({ id: uid('LR'), ...p, emoji: '📚', created_at: new Date().toISOString() }); setPostedLR(pool); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); go('learning'); showToast('已发布 ✓ 同步到云端'); return;
  }
  const d = getLR(); d.unshift({ id: uid('LR'), ...p, emoji: '📚', created_at: new Date().toISOString(), _local: true }); setLR(d);
  invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); go('learning');
  showToast('已保存到本机 ✓ 联网后自动同步，内容不会丢', 6000);
}

/* ===== 生活随笔 ===== */
const postList = document.getElementById('postList'), postInput = document.getElementById('postInput'), postTags = document.getElementById('postTags'), postPub = document.getElementById('postPub');
const PUB_HTML = postPub.innerHTML, SAVE_HTML = '<i class="fas fa-floppy-disk"></i> 保存修改';
const seenIds = new Set(), LKEY = 'chi_posts_local_v1'; let cloudOK = true, lifeImages = [], lifeList = [];
let lifeEditId = null, lifeEditLocal = false;
const SEED_LIFE = [{ id: 'sl1', content: '今天把进销存看板的"该补货吗"挪到了第一屏。看板的第一屏只该回答一个问题。', tags: ['复盘'], images: [], created_at: '2026-07-20T21:30:00Z' }, { id: 'sl2', content: '周末给草缸换了水，顺便把网球拍线也换了。生活和分析一样，定期维护才不会崩。🎾', tags: ['生活'], images: [], created_at: '2026-07-13T18:00:00Z' }];
function loadLocal() { try { const r = JSON.parse(localStorage.getItem(LKEY)); if (Array.isArray(r)) return r; } catch (e) { } return []; }
function saveLocal(p) { localStorage.setItem(LKEY, JSON.stringify(p)); }
function setSubText(on) { document.getElementById('postSubText').innerHTML = '分析之外的日常碎片。像发朋友圈一样记录生活——短小、即时、带图。'; }
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
  const tags = (p.tags || []).map(t => `<span>#${esc(t)}</span>`).join('');
  let imgHtml = '';
  if (imgs.length) {
    const cols = imgs.length >= 3 ? 3 : imgs.length;
    imgHtml = `<div class="life-grid lg-c${cols}">${imgs.map(s => `<div class="lg-cell"><img class="limg" src="${esc(s)}" data-img="${esc(s)}" alt="" loading="lazy"></div>`).join('')}</div>`;
  }
  const pinned = isPinned(p) ? `<span class="pin-flag">📌 置顶</span>` : '';
  const flag = p._local ? `<span class="draft-flag">📍 本机</span>` : '';
  const mgmt = p._seed ? '' : `<div class="life-mgmt"><button class="pc-m" data-life-edit="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-life-del="${esc(p.id)}" data-local="${p._local ? 1 : 0}" title="删除"><i class="fas fa-trash"></i></button></div>`;
  return `<div class="post"><div class="ph"><div class="pav">历</div><div class="pinfo"><div class="who">阿历</div><div class="when">${relTime(ts)}</div></div>${pinned}${flag}${mgmt}</div><div class="${ptxtCls}">${txtHtml}</div>${imgHtml}${tags ? `<div class="ptags">${tags}</div>` : ''}</div>`;
}
function renderPosts(posts, off) { if (!posts || !posts.length) { postList.innerHTML = off ? '<div class="no-result">离线暂存模式，先写一条存本机吧 ✍️</div>' : '<div class="no-result">还没有随笔，点「发一条随笔」写第一条 ✍️</div>'; return; } postList.innerHTML = posts.map(postHTML).join(''); }
function renderHomeLife() {
  const g = document.getElementById('homeLife'), head = document.getElementById('homeLifeHead');
  const list = lifeList.slice(0, 3);
  if (!list.length) { if (head) head.style.display = 'none'; g.innerHTML = ''; return; }
  if (head) head.style.display = 'flex';
  g.innerHTML = list.map(postHTML).join('');
}
async function loadPosts() {
  let data = null, err = null;
  if (sb) { try { const res = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 6000); data = res.data; err = res.error; } catch (e) { err = e; } }
  const hide = getLifeHide();
  if (err || data === null) {
    cloudOK = false; setSubText(false); lifeList = sortPosts([...SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })), ...loadLocal().map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]);
    const sets = lifeHideSets(); lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets));
    renderPosts(lifeList, true); return;
  }
  cloudOK = true; setSubText(true);
  const local = loadLocal(); if (local.length) { const remain = []; for (const x of local) { let ok = false; try { const r = await withTimeout(sb.from('posts').insert({ content: x.content, tags: x.tags, images: x.images || [] }), 12000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } saveLocal(remain); if (remain.length !== local.length) { try { const r2 = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r2.error && r2.data) data = r2.data; } catch (e) { } } }
  seenIds.clear(); (data || []).forEach(p => seenIds.add(p.id));
  const seedLife = (!data || !data.length) ? SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })) : [];
  lifeList = sortPosts([...(data || []), ...seedLife, ...loadLocal().map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]);
  lifeList = dedupePostedArr(lifeList, 'content');
  confirmPostedArr(getPostedLife(), data || [], 'content', setPostedLife);
  const sets = lifeHideSets(); lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets));
  renderPosts(lifeList, false);
}
function subscribeRT() { if (!sb) return; try { sb.channel('posts-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, pl => { if (!cloudOK) return; const p = pl.new; if (!p || seenIds.has(p.id)) return; seenIds.add(p.id); const e = postList.querySelector('.no-result'); if (e) e.remove(); postList.insertAdjacentHTML('afterbegin', postHTML(p)); }).subscribe(); } catch (e) { } }
function setLifeEditorMode(on) { postPub.innerHTML = on ? SAVE_HTML : PUB_HTML; }
function clearLifeEditor() { lifeEditId = null; lifeEditLocal = false; if (window.__rteLife) window.__rteLife.clear(); else postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs(); setLifeEditorMode(false); }
function openLifeEditor() { showView('lifeedit'); setNav('life'); window.scrollTo(0, 0); }
function editLife(id) { const p = lifeList.find(a => String(a.id) === String(id)); if (!p || p._seed) return; lifeEditId = String(id); lifeEditLocal = !!p._local; if (window.__rteLife) window.__rteLife.ed.innerHTML = toRTEHTML(p.content || ''); else postInput.value = toRTEHTML(p.content || ''); postTags.value = (p.tags || []).join(', '); lifeImages = (p.images || []).slice(); renderLifeThumbs(); setLifeEditorMode(true); openLifeEditor(); }
async function deleteLife(id, isLocal) {
  if (!confirm('确定删除这条随笔？此操作不可撤销。')) return;
  const sid = String(id);
  const target = lifeList.find(p => String(p.id) === sid);
  const isSeed = !!(target && target._seed);
  const delKey = normTxt(target ? contentOf(target) : '');
  const matchLife = x => String(x.id) === sid || (delKey !== '' && normTxt(contentOf(x)) === delKey);
  const pp = getPostedLife(); if (pp.some(matchLife)) setPostedLife(pp.filter(x => !matchLife(x)));
  if (isLocal) { saveLocal(loadLocal().filter(x => !matchLife(x))); }
  else if (isSeed) { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); }
  else if (sb) {
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('posts').delete().eq('id', sid), 12000); ok = !r.error; } catch (e) { } }
    if (!ok) { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); if (lifeEditId === sid) clearLifeEditor(); if (delKey) addLifeHideC(delKey); showToast('已在本机移除 ✓（云端副本需开删除权限才能彻底抹掉）'); loadPosts(); renderHomeLife(); return; }
  } else { const h = getLifeHide(); if (!h.includes(sid)) h.push(sid); setLifeHide(h); }
  if (delKey && !isSeed) addLifeHideC(delKey);
  if (lifeEditId === sid) clearLifeEditor(); showToast('已删除 ✓'); loadPosts(); renderHomeLife();
}
async function publishLife() {
  if (lifeEditId) {
    const content = (window.__rteLife && window.__rteLife.isEmpty()) ? '' : postInput.value.trim();
    const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    const imgs = lifeImages.filter(s => typeof s === 'string');
    postPub.disabled = true; postPub.textContent = '保存中…';
    const sid = String(lifeEditId); let ok = false;
    const pp = getPostedLife(); const pi = pp.findIndex(a => String(a.id) === sid);
    if (pi >= 0) { pp[pi] = Object.assign({}, pp[pi], { content, tags, images: imgs }); setPostedLife(pp); ok = true; }
    if (lifeEditLocal) { const l = loadLocal(); const idx = l.findIndex(a => String(a.id) === sid); if (idx >= 0) { l[idx] = Object.assign({}, l[idx], { content, tags, images: imgs }); saveLocal(l); ok = true; } } else if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('posts').update({ content, tags, images: imgs }).eq('id', sid), 20000); ok = !r.error; } catch (e) { } } }
    postPub.disabled = false;
    if (ok) { clearLifeEditor(); showToast('已保存修改 ✓'); go('life'); loadPosts(); renderHomeLife(); return; }
    postPub.innerHTML = SAVE_HTML; showToast('保存失败 · 原内容未丢失'); return;
  }
  const content = (window.__rteLife && window.__rteLife.isEmpty()) ? '' : postInput.value.trim();
  if (!content && !lifeImages.length) { if (window.__rteLife) window.__rteLife.focus(); else postInput.focus(); return; }
  const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
  const imgs = lifeImages.filter(s => typeof s === 'string');
  postPub.disabled = true; postPub.textContent = '发布中…';
  let ok = false; if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('posts').insert({ content, tags, images: imgs }), 20000); ok = !res.error; } catch (e) { } } }
  postPub.innerHTML = PUB_HTML; postPub.disabled = false;
  if (window.__rteLife) window.__rteLife.clear(); else postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs();
  if (ok) {
    const pool = getPostedLife(); pool.unshift({ id: uid('LF'), content, tags, images: imgs, created_at: new Date().toISOString() }); setPostedLife(pool); showToast('已发布 ✓ 实时同步中…'); go('life'); loadPosts(); renderHomeLife(); return;
  }
  const l = loadLocal(); l.unshift({ id: uid('LF'), content, tags, images: imgs, ts: Date.now(), created_at: new Date().toISOString(), _local: true }); saveLocal(l);
  cloudOK = false; setSubText(false);
  const hide = getLifeHide();
  lifeList = sortPosts([...SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })), ...l.map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]);
  const sets = lifeHideSets(); lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets));
  renderPosts(lifeList, true); renderHomeLife(); go('life');
  showToast('已保存到本机 ✓ 联网后自动补传', 6000);
}
postPub.addEventListener('click', publishLife);
document.getElementById('lifeBack').addEventListener('click', () => go('life'));
document.getElementById('lifeNewBtn').addEventListener('click', () => { clearLifeEditor(); openLifeEditor(); setTimeout(() => { if (window.__rteLife) window.__rteLife.focus(); else postInput.focus(); }, 150); });
function renderLifeThumbs() { document.getElementById('lifeThumbs').innerHTML = lifeImages.map((s, i) => { if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb uploading"><div class="up-spin"><i class="fas fa-spinner fa-spin"></i></div><span class="up-hint">上传中</span></div>`; return `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmlife="${i}">&times;</button></div>`; }).join(''); }
document.getElementById('lifeFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; await processImageUpload(f, lifeImages, renderLifeThumbs); } e.target.value = ''; });
document.getElementById('lifeThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmlife]'); if (b) { lifeImages.splice(+b.dataset.rmlife, 1); renderLifeThumbs(); } });
function exportLifeJSON() {
  const data = lifeList.map(p => ({ id: p.id, content: contentOf(p), tags: p.tags || [], images: p.images || [], created_at: p.created_at || (p.ts ? new Date(p.ts).toISOString() : null) }));
  if (!data.length) { showToast('暂无随笔可导出'); return; }
  const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), count: data.length, posts: data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = '生活随笔备份_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`已导出 ${data.length} 条随笔 ✓`);
}
document.getElementById('lifeExportBtn').addEventListener('click', exportLifeJSON);

/* ===== 搜索 ===== */
document.getElementById('lrSearch').addEventListener('input', e => { lrQuery = e.target.value.trim(); renderLearningList(); });
document.getElementById('globalSearch').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim(); if (!q) return;
  lrQuery = q;
  const ls = document.getElementById('lrSearch'); if (ls) ls.value = q;
  go('learning'); renderLearningList();
  showToast('已在学习成长中搜索「' + esc(q) + '」');
});

/* ===== 首页：统计 / 标签云 / 日历 ===== */
function renderStats() {
  const sp = document.getElementById('statProjects'), sl = document.getElementById('statLearning'), sf = document.getElementById('statLife');
  if (sp) sp.textContent = CASES.length;
  if (sl) sl.textContent = learningList.length;
  if (sf) sf.textContent = lifeList.length;
}
function renderTagCloud() {
  const el = document.getElementById('tagCloud'); if (!el) return;
  const cnt = {};
  learningList.forEach(p => (p.tags || []).forEach(t => { if (t !== '置顶') cnt[t] = (cnt[t] || 0) + 1; }));
  lifeList.forEach(p => (p.tags || []).forEach(t => { if (t !== '置顶') cnt[t] = (cnt[t] || 0) + 1; }));
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 12);
  el.innerHTML = top.length ? top.map(([t, n]) => `<button type="button" class="tagchip" data-tag="${esc(t)}">${esc(t)}<small>${n}</small></button>`).join('') : '<span style="font-size:.85rem;color:var(--ink-3)">暂无标签</span>';
}
document.getElementById('tagCloud').addEventListener('click', e => {
  const b = e.target.closest('.tagchip'); if (!b) return;
  lrQuery = b.dataset.tag;
  const ls = document.getElementById('lrSearch'); if (ls) ls.value = lrQuery;
  go('learning'); renderLearningList();
});
/* ===== 农历 / 节气 / 节假日 数据与算法 ===== */
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06aa0,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
  0x0d520
];
const LUNAR_MONTH_CN = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const LUNAR_DAY_CN = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const SOLAR_TERMS = [
  '小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨',
  '立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑',
  '白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'
];
const TERM_C = [
  5.4055,20.12,3.87,18.73,5.63,20.646,4.81,20.1,
  5.52,21.04,5.678,21.37,7.108,22.83,7.5,23.13,
  7.646,23.042,8.318,23.438,7.438,22.36,7.18,21.94
];
const FESTIVALS = {
  '01-01':'元旦','02-14':'情人节','03-08':'妇女节','03-12':'植树节',
  '04-01':'愚人节','05-01':'劳动节','05-04':'青年节','06-01':'儿童节',
  '07-01':'建党节','08-01':'建军节','09-10':'教师节','10-01':'国庆节',
  '12-25':'圣诞节'
};
const LUNAR_FESTIVALS = {
  '01-01':'春节','01-15':'元宵节','05-05':'端午节',
  '07-07':'七夕','07-15':'中元节','08-15':'中秋节',
  '09-09':'重阳节','12-08':'腊八节','12-30':'除夕'
};
function lunarYearDays(y) { let sum = 348; for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return sum + leapMonthDays(y); }
function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function leapMonthDays(y) { return leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function solarToLunar(sy, sm, sd) {
  if (sy < 1901 || sy > 2099) return null;
  const baseDate = new Date(1900, 0, 31);
  const objDate = new Date(sy, sm - 1, sd);
  let offset = Math.floor((objDate - baseDate) / 86400000);
  let ly = 1900, temp = 0;
  for (; ly < 2101 && offset > 0; ly++) { temp = lunarYearDays(ly); offset -= temp; }
  if (offset < 0) { offset += temp; ly--; }
  let lm = 1; const leap = leapMonth(ly); let isLeap = false;
  for (; lm < 13 && offset > 0; lm++) {
    if (leap > 0 && lm === (leap + 1) && !isLeap) { --lm; isLeap = true; temp = leapMonthDays(ly); }
    else { temp = monthDays(ly, lm); }
    if (isLeap && lm === (leap + 1)) isLeap = false;
    offset -= temp;
  }
  if (offset < 0) { offset += temp; --lm; }
  return { year: ly, month: lm, day: offset + 1, isLeap };
}
function getSolarTerm(y, m, d) {
  const idx = (m - 1) * 2;
  const century = y >= 2000 ? 20 : 19;
  const yy = y % 100;
  const t1 = Math.floor(yy * 0.2422 + TERM_C[idx]) - Math.floor((yy - (century === 20 ? 0 : 1)) / 4);
  const t2 = Math.floor(yy * 0.2422 + TERM_C[idx + 1]) - Math.floor((yy - (century === 20 ? 0 : 1)) / 4);
  if (d === t1) return SOLAR_TERMS[idx];
  if (d === t2) return SOLAR_TERMS[idx + 1];
  return null;
}
function getDayLabel(y, m, d) {
  const fkey = String(m).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  if (FESTIVALS[fkey]) return { text: FESTIVALS[fkey], type: 'festival' };
  const term = getSolarTerm(y, m, d);
  if (term) return { text: term, type: 'solar-term' };
  const lunar = solarToLunar(y, m, d);
  if (!lunar) return { text: '', type: '' };
  const lkey = String(lunar.month).padStart(2,'0') + '-' + String(lunar.day).padStart(2,'0');
  if (LUNAR_FESTIVALS[lkey]) return { text: LUNAR_FESTIVALS[lkey], type: 'festival' };
  const lmd = lunar.day === 1
    ? (lunar.isLeap ? '闰' + LUNAR_MONTH_CN[lunar.month - 1] + '月' : LUNAR_MONTH_CN[lunar.month - 1] + '月')
    : LUNAR_DAY_CN[lunar.day - 1];
  return { text: lmd, type: '' };
}
let calY, calM;
(function initCal() { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); })();
function renderCal() {
  const grid = document.getElementById('calGrid'), title = document.getElementById('calTitle');
  if (!grid || !title) return;
  title.textContent = calY + '年' + (calM + 1) + '月';
  const lifeDates = new Set(lifeList.map(p => (p.created_at || '').slice(0, 10)));
  const lrDates = new Set(learningList.map(p => (p.created_at || '').slice(0, 10)));
  const first = new Date(calY, calM, 1);
  const startDow = first.getDay();
  const days = new Date(calY, calM + 1, 0).getDate();
  const today = new Date();
  let html = ['日','一','二','三','四','五','六'].map(w => `<span class="cal-w">${w}</span>`).join('');
  for (let i = 0; i < startDow; i++) html += '<span class="cal-d"></span>';
  for (let d = 1; d <= days; d++) {
    const iso = `${calY}-${String(calM + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = ['cal-d'];
    const label = getDayLabel(calY, calM + 1, d);
    if (today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d) cls.push('today');
    if (label.type === 'festival') cls.push('festival');
    if (label.type === 'solar-term') cls.push('solar-term');
    if (lifeDates.has(iso)) cls.push('has-life');
    if (lrDates.has(iso)) cls.push('has-lr');
    html += `<span class="${cls.join(' ')}"><span class="cd-num">${d}</span><span class="cd-sub">${label.text}</span></span>`;
  }
  grid.innerHTML = html;
}
document.getElementById('calPrev').addEventListener('click', () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); });
document.getElementById('calNext').addEventListener('click', () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); });

/* ===== 天干地支 + 时辰 + 农历 ===== */
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SX = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const CN_M = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const CN_D = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
function ganzhiYear(y) { return GAN[((y - 4) % 10 + 10) % 10] + ZHI[((y - 4) % 12 + 12) % 12]; }
function shiChen(h) { return ZHI[Math.floor(((h + 1) % 24) / 2)] + '时'; }
function lunarMD(d) {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(d);
    const m = +parts.find(x => x.type === 'month').value;
    const dd = +parts.find(x => x.type === 'day').value;
    return '农历' + CN_M[m - 1] + '月' + CN_D[dd - 1];
  } catch (e) { return ''; }
}
const WK = ['日', '一', '二', '三', '四', '五', '六'];
function greet(h) { return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
function tick() {
  const d = new Date();
  const dt = document.getElementById('dateText');
  if (dt) dt.innerHTML = `今天是 <b>${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日</b>，周${WK[d.getDay()]} · ${greet(d.getHours())}`;
  const gz = document.getElementById('ganzhiText');
  if (gz) gz.innerHTML = `${ganzhiYear(d.getFullYear())}年 · ${shiChen(d.getHours())}${d.getHours() === 23 ? '（夜子时）' : ''} · 属${SX[((d.getFullYear() - 4) % 12 + 12) % 12]} · ${lunarMD(d)}`;
  const p = n => String(n).padStart(2, '0');
  document.getElementById('clock').textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
tick(); setInterval(tick, 1000);

/* ===== 联系方式 / lightbox ===== */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-qr],[data-mail]'); if (!b) return; e.preventDefault();
  if (b.hasAttribute('data-mail')) { location.href = 'mailto:' + b.getAttribute('data-mail'); return; }
  const modal = document.getElementById('qrModal'), card = document.getElementById('qrCard'), img = document.getElementById('qrImg'), title = document.getElementById('qrTitle'), fb = document.getElementById('qrFallback');
  const src = b.getAttribute('data-qr');
  card.classList.remove('no-img'); title.textContent = '扫码加我 · ' + (b.getAttribute('data-qr-title') || '');
  img.onload = function () { card.classList.remove('no-img'); };
  img.onerror = function () { card.classList.add('no-img'); if (fb) fb.innerHTML = '还没上传 <b>' + src + '</b><br>把这张二维码图片放到网站根目录，<br>刷新后这里就能扫码 👆'; };
  img.src = src; modal.classList.add('open');
});
document.getElementById('qrModal').addEventListener('click', e => { if (e.target.id === 'qrModal' || e.target.closest('.qr-close')) document.getElementById('qrModal').classList.remove('open'); });
document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox' || e.target.closest('[data-close]')) { document.getElementById('lightbox').classList.remove('on'); lockScroll(false); setTimeout(() => document.getElementById('lbImg').src = '', 300); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.getElementById('lightbox').classList.remove('on'); lockScroll(false); } });

/* ===== 简历 PDF 预览 ===== */
(function () {
  const pm = document.getElementById('pdfModal'), pf = document.getElementById('pdfFrame'), pn = document.getElementById('pdfName'), pd = document.getElementById('pdfDl'), po = document.getElementById('pdfOpen'), pLoad = document.getElementById('pdfLoading'), pHint = document.getElementById('pdfHint');
  let fileEnc = '', fileView = '';
  function showIframe() { pf.src = fileView; pf.style.display = 'block'; pLoad.style.display = 'none'; pHint.style.display = 'none'; po.style.display = 'inline-flex'; po.setAttribute('href', fileView); }
  function showHint(name, msg) { pf.style.display = 'none'; pLoad.style.display = 'none'; pHint.style.display = 'grid'; pHint.innerHTML = '⚠️ ' + msg + '<br>请确认 <b>' + name + '</b> 已上传到网站根目录、且文件名与仓库<b>一字不差</b>。<br>也可点右上"新标签打开"或"下载"查看。'; po.style.display = 'inline-flex'; po.setAttribute('href', fileView); }
  function openPdf(file) { if (!pm) return; fileEnc = encodeURI(file); fileView = fileEnc + '#toolbar=1&navpanes=0&view=FitH'; const name = decodeURIComponent(file.split('/').pop()); pn.textContent = name; pd.setAttribute('href', fileEnc); po.setAttribute('href', fileView); pf.style.display = 'none'; pHint.style.display = 'none'; po.style.display = 'none'; pLoad.style.display = 'grid'; pm.classList.add('open'); lockScroll(true); fetch(fileEnc, { method: 'HEAD' }).then(function (r) { const ct = (r.headers.get('content-type') || '').toLowerCase(); if (r.ok && ct.indexOf('pdf') >= 0) { showIframe(); return; } if (r.ok && ct.indexOf('html') >= 0) { showHint(name, '取到的是网页不是 PDF（多半文件名对不上，被兜底成首页了）。'); return; } return fetch(fileEnc).then(function (r2) { if (!r2.ok) throw 0; return r2.arrayBuffer().then(function (buf) { const h = new Uint8Array(buf.slice(0, 5)), s = []; for (let i = 0; i < h.length; i++) s.push(String.fromCharCode(h[i])); if (s.join('') === '%PDF-') showIframe(); else showHint(name, '取到的不是 PDF 文件。'); }); }); }).catch(function () { showHint(name, '读取简历时出错。'); }); }
  function closePdf() { if (!pm) return; pm.classList.remove('open'); pf.src = 'about:blank'; pf.style.display = 'none'; pLoad.style.display = 'grid'; pHint.style.display = 'none'; lockScroll(false); }
  document.addEventListener('click', function (e) { const b = e.target.closest('[data-pdf]'); if (!b) return; e.preventDefault(); openPdf(b.getAttribute('data-pdf')); });
  if (pm) { pm.addEventListener('click', function (e) { if (e.target === pm) closePdf(); }); document.getElementById('pdfClose').addEventListener('click', closePdf); }
})();

/* ===== 主题 / 回顶 / 品牌 ===== */
const root = document.documentElement, themeBtn = document.getElementById('themeBtn');
function setTheme(t) { root.setAttribute('data-theme', t); localStorage.setItem('chi_theme', t); themeBtn.innerHTML = t === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; }
setTheme(localStorage.getItem('chi_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
themeBtn.onclick = () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 500), { passive: true });
toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
const brand = document.getElementById('brandHome');
function goHome() { if (location.hash !== '#home') history.replaceState(null, '', '#home'); go('home'); }
if (brand) {
  brand.addEventListener('click', e => { e.preventDefault(); goHome(); });
  brand.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); brand.click(); } });
}
window.addEventListener('hashchange', route);
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

/* ===== 富文本编辑器 ===== */
function makeRTE(ta, opts) {
  opts = opts || {};
  if (!ta) return null;
  var proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  var descSet = function (v) { proto.set.call(ta, v); };
  var savedRange = null;
  var wrap = document.createElement('div'); wrap.className = 'rte-wrap';
  var bar = document.createElement('div'); bar.className = 'rte-bar';
  function b(ic, title, cmd) { return '<button type="button" class="rte-b" title="' + title + '" data-cmd="' + cmd + '"><i class="fas ' + ic + '"></i></button>'; }
  function sep() { return '<span class="rte-sep"></span>'; }
  function g(label, items) { return '<span class="rte-grp"><button type="button" class="rte-b rte-gb">' + label + ' <i class="fas fa-caret-down"></i></button><span class="rte-menu">' + items.map(function (it) { var t = it.split('|'); return '<button type="button" class="rte-mi" data-sub="' + t[1] + '">' + t[0] + '</button>'; }).join('') + '</span></span>'; }
  bar.innerHTML = [
    g('字号', ['小|fs:15px', '标准|fs:17px', '大|fs:21px', '特大|fs:27px']), sep(),
    b('fa-bold', '加粗', 'bold'), b('fa-italic', '斜体', 'italic'), b('fa-underline', '下划线', 'underline'), sep(),
    g('行距', ['紧凑|lh:1.5', '舒适|lh:1.85', '宽松|lh:2.2']), g('段距', ['紧|pg:6px', '中|pg:14px', '松|pg:24px']), sep(),
    b('fa-align-left', '左对齐', 'justifyLeft'), b('fa-align-center', '居中', 'justifyCenter'), b('fa-align-right', '右对齐', 'justifyRight'), sep(), b('fa-quote-left', '引用', 'quote'), b('fa-list-ul', '无序列表', 'insertUnorderedList'), b('fa-list-ol', '有序列表', 'insertOrderedList'),
    b('fa-link', '链接', 'link'), b('fa-image', '图片', 'img'), b('fa-grip-lines', '分割线', 'insertHorizontalRule'), sep(),
    b('fa-plus', '放大字号', 'fontSizePlus'), b('fa-minus', '缩小字号', 'fontSizeMinus'), sep(),
    b('fa-eraser', '清除格式', 'removeFormat'), b('fa-rotate-left', '撤销', 'undo')
  ].join('');
  var ed = document.createElement('div'); ed.className = 'rte'; ed.contentEditable = 'true';
  ed.setAttribute('data-ph', opts.ph || '');
  ed.style.setProperty('--rte-lh', '1.85'); ed.style.setProperty('--rte-pg', '14px');
  ta.parentNode.insertBefore(wrap, ta); wrap.appendChild(bar); wrap.appendChild(ed); wrap.appendChild(ta); ta.style.display = 'none';
  function syncEmpty() { ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('img,li,blockquote,hr')); }
  function saveRange() { var s = getSelection(); if (s && s.rangeCount && ed.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); }
  function restoreRange() { if (savedRange) { var s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
  function selText() { var s = getSelection(); return (s && s.toString()) ? s.toString() : '文字'; }
  function applyVar(k, val) { if (k === 'lh') ed.style.setProperty('--rte-lh', val); else if (k === 'pg') ed.style.setProperty('--rte-pg', val); else if (k === 'fs') { try { document.execCommand('insertHTML', false, '<span style="font-size:' + val + '">' + selText() + '</span>'); } catch (e) { } } after(); }
  function changeSelFontSize(dir) {
    var s = getSelection();
    var refNode = (s && s.rangeCount) ? s.getRangeAt(0).startContainer : ed;
    if (refNode.nodeType === 3) refNode = refNode.parentNode;
    if (!refNode || !ed.contains(refNode)) refNode = ed;
    var cur = parseInt(getComputedStyle(refNode).fontSize) || 16;
    var ns = Math.min(40, Math.max(12, cur + dir * 2));
    if (s && s.rangeCount && !s.isCollapsed) { var rng = s.getRangeAt(0); try { var sp = document.createElement('span'); sp.style.fontSize = ns + 'px'; rng.surroundContents(sp); } catch (e) { var f = rng.extractContents(); var sp2 = document.createElement('span'); sp2.style.fontSize = ns + 'px'; sp2.appendChild(f); rng.insertNode(sp2); } }
    else { var blk = refNode.closest ? refNode.closest('p,div,li,h1,h2,h3,h4,h5,h6,blockquote') : null; if (blk && ed.contains(blk)) blk.style.fontSize = ns + 'px'; }
    after();
  }
  function run(c) {
    try { document.execCommand('styleWithCSS', false, 'true'); } catch (e) { }
    if (c === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    else if (c === 'link') { var u = prompt('链接地址 https://…'); if (u) document.execCommand('createLink', false, u); }
    else if (c === 'img') { var ui = prompt('图片地址 https://…'); if (ui) document.execCommand('insertImage', false, ui); }
    else if (c === 'removeFormat') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }
    else if (c === 'fontSizePlus') changeSelFontSize(1);
    else if (c === 'fontSizeMinus') changeSelFontSize(-1);
    else document.execCommand(c, false, null);
    after();
  }
  function after() { descSet(ed.innerHTML); syncEmpty(); saveRange(); }
  ed.addEventListener('input', function () { descSet(ed.innerHTML); syncEmpty(); saveRange(); });
  ed.addEventListener('mouseup', saveRange); ed.addEventListener('keyup', saveRange);
  ed.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (typeof opts.onCtrlEnter === 'function') opts.onCtrlEnter(); } });
  bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
  bar.addEventListener('click', function (e) { var btn = e.target.closest('[data-sub],[data-cmd]'); if (!btn) return; ed.focus(); restoreRange(); if (btn.dataset.sub) { var p = btn.dataset.sub.split(':'); applyVar(p[0], p[1]); } else run(btn.dataset.cmd); });
  Object.defineProperty(ta, 'value', { configurable: true, set: function (v) { descSet(v); if (ed.innerHTML !== (v || '')) { ed.innerHTML = v || ''; syncEmpty(); } }, get: function () { return proto.get.call(ta); } });
  syncEmpty();
  return {
    ed: ed,
    isEmpty: function () { return !ed.textContent.trim() && !ed.querySelector('img,li,blockquote,hr,a,table'); },
    clear: function () { descSet(''); ed.innerHTML = ''; syncEmpty(); },
    focus: function () { ed.focus(); }
  };
}

/* ===== 启动 ===== */
renderCases(); renderCerts(); renderHomeCases();
primeLearningSync(); primeLifeSync();
route();
subscribeRT();
renderCal(); renderStats(); renderTagCloud();
loadLearning().then(() => { renderLearningList(); renderHomeLatest(); renderStats(); renderTagCloud(); renderCal(); });
loadPosts().then(() => { renderPosts(lifeList, !cloudOK); renderHomeLife(); renderStats(); renderTagCloud(); renderCal(); });
window.__rte = makeRTE(document.getElementById('lrContent'), { ph: '正文… 支持加粗 / 列表 / 引用 / 字号±等排版', onCtrlEnter: publishLearning });
window.__rteLife = makeRTE(document.getElementById('postInput'), { ph: '写点什么… 今天的一个小发现、一段心情。', onCtrlEnter: publishLife });
window.renderLearningList = renderLearningList;
window.renderHomeLatest = renderHomeLatest;
window.renderPosts = renderPosts;
window.renderHomeLife = renderHomeLife;
/* ===== 补丁 v20260806d：修复"删重复把正本也隐藏" ===== */
try { localStorage.removeItem('chi_life_hide_content'); } catch (e) {}
function lifeIsHiddenObj(p, sets) { return sets.hidSet.has(String(p && p.id)); }
/* ===== 补丁 v20260806d：修复"删重复把正本也隐藏" ===== */
try { localStorage.removeItem('chi_life_hide_content'); } catch (e) {}
function lifeIsHiddenObj(p, sets) { return sets.hidSet.has(String(p && p.id)); }
