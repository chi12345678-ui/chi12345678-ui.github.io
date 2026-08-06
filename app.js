/* ===== 云端（带"加载失败也不崩"保险） ===== */
const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
let sb = null;
try { sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null; } catch (e) { sb = null; }

/* ===== 工具 ===== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
function showToast(h, ms = 4200) { toastEl.innerHTML = h; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { } document.body.removeChild(a); return ok; } }
function compress(file, max = 1000, q = 0.7) { return new Promise(res => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > max || h > max) { if (w > h) { h = h * max / w; w = max; } else { w = w * max / h; h = max; } } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', q)); }; img.src = r.result; }; r.readAsDataURL(file); }); }

/* ===== 图片上传：优先 Supabase Storage，断网 fallback base64 ===== */
const IMG_BUCKET = 'learning-images';
async function uploadImageToStorage(file) { if (!sb) throw new Error('Supabase 未连接'); const ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`; const { data, error } = await sb.storage.from(IMG_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' }); if (error) throw error; const { data: { publicUrl } } = sb.storage.from(IMG_BUCKET).getPublicUrl(path); return publicUrl; }
async function processImageUpload(file, arr, renderFn) { const placeholder = { _uploading: true, name: file.name }; arr.push(placeholder); const idx = arr.length - 1; renderFn(); try { if (sb) { const url = await uploadImageToStorage(file); arr[idx] = url; } else { arr[idx] = await compress(file); } } catch (err) { console.error('图片上传失败，fallback base64', err); try { arr[idx] = await compress(file); } catch (e2) { arr.splice(idx, 1); showToast('「' + file.name + '」上传失败'); renderFn(); return; } } renderFn(); }
async function migrateImagesToStorage(images) { const out = []; for (const s of images || []) { if (!s || typeof s !== 'string' || !s.startsWith('data:image')) { out.push(s); continue; } try { const res = await fetch(s); const blob = await res.blob(); const file = new File([blob], 'image.jpg', { type: 'image/jpeg' }); const url = await uploadImageToStorage(file); out.push(url); } catch (e) { out.push(s); } } return out; }

/* ===== 附件上传 ===== */
const FILE_BUCKET = 'learning-files';
async function uploadFileToStorage(file) {
  if (!sb) throw new Error('Supabase 未连接');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `files/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { data, error } = await sb.storage.from(FILE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from(FILE_BUCKET).getPublicUrl(path);
  return { url: publicUrl, name: file.name, size: file.size, type: file.type };
}
async function processFileUpload(file, arr, renderFn) {
  const placeholder = { _uploading: true, name: file.name };
  arr.push(placeholder);
  const idx = arr.length - 1;
  renderFn();
  try {
    if (sb) {
      const meta = await uploadFileToStorage(file);
      arr[idx] = meta;
    } else {
      // 断网：base64 存储
      const reader = new FileReader();
      const dataUrl = await new Promise((res, rej) => { reader.onload = () => res(reader.result); reader.onerror = rej; reader.readAsDataURL(file); });
      arr[idx] = { url: dataUrl, name: file.name, size: file.size, type: file.type, _base64: true };
    }
  } catch (err) {
    console.error('附件上传失败', err);
    arr.splice(idx, 1);
    showToast('「' + file.name + '」上传失败：' + (err.message || '未知错误'));
    renderFn();
    return;
  }
  renderFn();
}

const linkify = h => esc(h).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isPinned = a => (a.tags || []).includes('置顶');
function sortPosts(arr) { return arr.slice().sort((a, b) => { const pa = isPinned(a) ? 1 : 0, pb = isPinned(b) ? 1 : 0; if (pa !== pb) return pb - pa; return new Date(b.created_at) - new Date(a.created_at); }); }
window.__isHTML = function (s) { return /<[a-z][\s\S]*>/i.test(s || ''); };
function toRTEHTML(raw) { raw = raw == null ? '' : String(raw); if (window.__isHTML(raw)) return raw; return raw.split('\n').map(l => { const e = esc(l); return '<p>' + (e || '<br>') + '</p>'; }).join(''); }
function normTxt(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function contentOf(p) { return p && (p.content != null ? p.content : (p.txt != null ? p.txt : '')); }

/* ===== 乐观发布池：自己发的立刻可见、刷新不丢 ===== */
const POSTED_LIFE_KEY = 'chi_posts_posted_v1', POSTED_LR_KEY = 'chi_lr_posted_v1';
const getPostedLife = () => { try { const r = JSON.parse(localStorage.getItem(POSTED_LIFE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setPostedLife = a => localStorage.setItem(POSTED_LIFE_KEY, JSON.stringify(a));
const getPostedLR = () => { try { const r = JSON.parse(localStorage.getItem(POSTED_LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setPostedLR = a => localStorage.setItem(POSTED_LR_KEY, JSON.stringify(a));

/* ===== 全局去重（修复学习成长重复显示问题） ===== */
function dedupeAll(arr, keyFn) {
  const seen = new Set();
  return arr.filter(p => {
    const k = keyFn(p);
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function dedupeLearning(arr) {
  // 优先按 id 去重，没 id 的按 title+content 去重
  const byId = new Set();
  const byContent = new Set();
  return arr.filter(p => {
    if (p.id) {
      if (byId.has(String(p.id))) return false;
      byId.add(String(p.id));
      return true;
    }
    const key = normTxt(p.title || '') + '||' + normTxt(contentOf(p)).slice(0, 200);
    if (byContent.has(key)) return false;
    byContent.add(key);
    return true;
  });
}
function dedupeLife(arr) {
  const byId = new Set();
  const byContent = new Set();
  return arr.filter(p => {
    if (p.id) {
      if (byId.has(String(p.id))) return false;
      byId.add(String(p.id));
      return true;
    }
    const key = normTxt(contentOf(p)).slice(0, 300);
    if (byContent.has(key)) return false;
    byContent.add(key);
    return true;
  });
}

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

/* ===== 数据找回 ===== */
function collectAllBackupCandidates() {
  const sets = lifeHideSets();
  const SKIP_KEY = /^chi_lr|^chi_theme$|^chi_offline$/;
  const cands = [], seen = new Set();
  function pushArr(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      if ('title' in p) return;
      const content = contentOf(p);
      const imgs = Array.isArray(p.images) ? p.images : [];
      if (!String(content).trim() && !imgs.length) return;
      if (lifeIsHiddenObj({ id: p.id, content: content, txt: p.txt }, sets)) return;
      const key = normTxt(content) + '||' + imgs.join(',');
      if (seen.has(key)) return;
      seen.add(key);
      let ca = p.created_at || null;
      if (!ca && p.ts) { try { ca = new Date(p.ts).toISOString(); } catch (e) { ca = null; } }
      cands.push({ id: p.id || null, content: content, tags: Array.isArray(p.tags) ? p.tags : [], images: imgs, created_at: ca });
    });
  }
  try { const raw = localStorage.getItem('dg_life_migrated_backup'); if (raw) pushArr(JSON.parse(raw)); } catch (e) { }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || SKIP_KEY.test(k)) continue;
      let v; try { v = localStorage.getItem(k); } catch (e) { continue; }
      if (!v || v.charAt(0) !== '[') continue;
      let arr; try { arr = JSON.parse(v); } catch (e) { continue; }
      pushArr(arr);
    }
  } catch (e) { }
  return cands;
}
function recoverLifeBackup(cands) {
  try {
    if (!cands || !cands.length) return;
    const sets = lifeHideSets();
    let posted = getPostedLife();
    const have = {};
    posted.forEach(p => { have['c:' + normTxt(contentOf(p))] = 1; });
    let added = 0;
    cands.forEach(p => {
      if (lifeIsHiddenObj(p, sets)) return;
      const key = 'c:' + normTxt(p.content);
      if (have[key]) return;
      have[key] = 1;
      posted.push({ id: p.id || uid('LF'), content: p.content, tags: p.tags || [], images: p.images || [], created_at: p.created_at || new Date().toISOString() });
      added++;
    });
    if (added) { setPostedLife(posted); console.log('[recover] 已从各存储源找回 ' + added + ' 条随笔并入显示池。'); }
  } catch (e) { console.warn('[recover] 跳过：', e); }
}
async function migrateBackupToCloud(cands) {
  if (!sb || !cands || !cands.length) return;
  const sets = lifeHideSets();
  const cloudHave = new Set();
  try {
    const res = await withTimeout(sb.from('posts').select('content').limit(1000), 8000);
    if (res.error || !res.data) return;
    res.data.forEach(p => cloudHave.add(normTxt(p.content)));
  } catch (e) { return; }
  let doneSet = new Set();
  try { const r = JSON.parse(localStorage.getItem('dg_migrated_contents')); if (Array.isArray(r)) doneSet = new Set(r); } catch (e) { }
  let uploaded = 0, skipped = 0, failed = 0;
  for (const p of cands) {
    if (lifeIsHiddenObj(p, sets)) continue;
    const key = normTxt(p.content);
    if (!key && !(p.images || []).length) continue;
    if ((key && cloudHave.has(key)) || (key && doneSet.has(key))) { skipped++; continue; }
    const payload = { content: p.content, tags: p.tags || [], images: p.images || [] };
    let ok = false;
    try {
      let r;
      if (p.created_at) { r = await withTimeout(sb.from('posts').insert({ ...payload, created_at: p.created_at }), 15000); if (r.error) r = await withTimeout(sb.from('posts').insert(payload), 15000); }
      else { r = await withTimeout(sb.from('posts').insert(payload), 15000); }
      ok = !r.error;
    } catch (e) { try { const r2 = await withTimeout(sb.from('posts').insert(payload), 15000); ok = !r2.error; } catch (e2) { ok = false; } }
    if (ok) { uploaded++; if (key) { cloudHave.add(key); doneSet.add(key); } } else failed++;
  }
  if (doneSet.size) localStorage.setItem('dg_migrated_contents', JSON.stringify([...doneSet]));
  if (uploaded > 0) { showToast(`已找回并同步到云端：新上传 ${uploaded} 条${skipped ? '，跳过已存在 ' + skipped + ' 条' : ''} ✓`, 5500); loadPosts().then(() => renderHomeLife()); }
  else if (failed > 0) { showToast(`同步部分失败：成功 ${uploaded}、失败 ${failed}（刷新自动重试；反复失败请检查 INSERT 权限）`, 6500); }
}

/* ===== 一键导出全部随笔为 JSON ===== */
function exportLifeJSON() {
  const data = lifeList.map(p => ({ id: p.id, content: contentOf(p), tags: p.tags || [], images: p.images || [], created_at: p.created_at || (p.ts ? new Date(p.ts).toISOString() : null) }));
  if (!data.length) { showToast('暂无随笔可导出'); return; }
  const payload = { exported_at: new Date().toISOString(), count: data.length, posts: data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '生活随笔备份_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`已导出 ${data.length} 条随笔 ✓`);
}
function injectExportBtn() {
  const list = document.getElementById('postList');
  if (!list || document.getElementById('lifeExportBtn')) return;
  const bar = document.createElement('div');
  bar.className = 'life-toolbar';
  bar.innerHTML = '<button id="lifeExportBtn" class="btn btn-ghost" style="font-size:13px;padding:8px 14px"><i class="fas fa-file-export"></i> 导出全部随笔 JSON</button>';
  list.parentNode.insertBefore(bar, list);
  document.getElementById('lifeExportBtn').addEventListener('click', exportLifeJSON);
}

/* ===== 路由 ===== */
const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('#nav a')];
function revealIn(v) { const els = v.querySelectorAll('.reveal'); els.forEach(e => e.classList.remove('in')); requestAnimationFrame(() => requestAnimationFrame(() => { let i = 0; els.forEach(e => { e.style.transitionDelay = (Math.min(i++, 7) * 0.04) + 's'; e.classList.add('in'); }); })); }
function showView(n) { views.forEach(v => v.classList.toggle('active', v.dataset.view === n)); const c = document.querySelector('.view.active'); if (c) revealIn(c); window.scrollTo(0, 0); }
function setNav(n) { navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === n)); }
function go(target) { const cur = location.hash.replace(/^#/, ''); if (cur === target) { route(); } else { location.hash = target; } }
function curHash() { return location.hash.replace(/^#/, '') || 'home'; }

function primeLearningSync() { if (learningList.length) return; learningList = sortPosts([...SEED_LEARNING, ...getLR().map(x => ({ ...x, _local: true })), ...getPostedLR().map(x => ({ ...x, _posted: true }))]); learningList = applyLocalOverlay(learningList); learningList = dedupeLearning(learningList); }
function primeLifeSync() { if (lifeList.length) return; const hide = getLifeHide(); lifeList = sortPosts([...SEED_LIFE.filter(s => !hide.includes(s.id)).map(s => ({ ...s, _seed: true })), ...loadLocal().map(x => ({ ...x, _local: true })), ...getPostedLife().map(x => ({ ...x, _posted: true }))]); const sets = lifeHideSets(); lifeList = lifeList.filter(p => !lifeIsHiddenObj(p, sets)); lifeList = dedupeLife(lifeList); }

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
  if (view === 'home') { primeLearningSync(); primeLifeSync(); renderHomeLatest(); renderHomeLife(); }
  if (view === 'archive') { primeLearningSync(); primeLifeSync(); renderArchive(); }
  if (view === 'projects') { renderCases(); }
  const valid = ['home', 'about', 'projects', 'learning', 'life', 'archive', 'resume'].includes(view) ? view : 'home';
  showView(valid); setNav(valid);
  if (view === 'learning') { loadLearning().then(() => { if (curHash() === 'learning') renderLearningList(); }); }
  if (view === 'life') { loadPosts().then(() => { if (curHash() === 'life') renderPosts(lifeList, !cloudOK); }); }
  if (view === 'home') {
    loadLearning().then(() => { if (curHash() === 'home') { renderHomeLatest(); } });
    loadPosts().then(() => { if (curHash() === 'home') renderHomeLife(); });
  }
  if (view === 'archive') {
    loadLearning().then(() => { if (curHash() === 'archive') renderArchive(); });
    loadPosts().then(() => { if (curHash() === 'archive') renderArchive(); });
  }
}

document.addEventListener('click', e => {
  const sync = e.target.closest('.sync-btn'); if (sync) { e.preventDefault(); e.stopPropagation(); resyncOne(sync.dataset.sync); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { e.preventDefault(); e.stopPropagation(); editLearning(ed.dataset.edit); return; }
  const dl = e.target.closest('[data-del]'); if (dl) { e.preventDefault(); e.stopPropagation(); deleteLearning(dl.dataset.del, dl.dataset.local === '1'); return; }
  const le = e.target.closest('[data-life-edit]'); if (le) { e.preventDefault(); e.stopPropagation(); editLife(le.dataset.lifeEdit); return; }
  const ld = e.target.closest('[data-life-del]'); if (ld) { e.preventDefault(); e.stopPropagation(); deleteLife(ld.dataset.lifeDel, ld.dataset.local === '1'); return; }
  const pc = e.target.closest('.postcard'); if (pc) { e.preventDefault(); go('read/' + encodeURIComponent(pc.dataset.id)); return; }
  const limg = e.target.closest('.limg'); if (limg) { openLB(limg.dataset.img || limg.src); return; }
  const a = e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute('href').slice(1)); }
});

/* ===== 项目案例 ===== */
const CASES = [
  { color: 'linear-gradient(135deg,#e8730c,#ff9d4d)', icon: 'fa-layer-group', tag: 'USER VALUE', title: 'RFM 用户价值分析案例', desc: '基于 SQL 取数 + Python(Pandas) 构建 RFM 模型，对线上平台用户做三维度打分与分层，输出可复现的交互式分析报告。', tech: ['SQL', 'Python', 'Pandas', 'Jupyter'], docs: [{ label: '交互式报告', href: '线上平台用户RFM分析.html' }], dl: '线上平台用户RFM分析.ipynb' },
  { color: 'linear-gradient(135deg,#2f6fed,#5b8def)', icon: 'fa-boxes-stacked', tag: 'INVENTORY', title: '快消品进销存分析', desc: '以 Power BI 完成数据建模与清洗，搭建进销存看板 + 分析报告：监控库存、月销与临期风险，完成 ABC 动销与智能补货诊断。', tech: ['Power BI', 'DAX'], docs: [{ label: '演示案例', href: '快消品进销存演示案例.pdf' }, { label: '分析报告', href: '快消品进销存案例分析报告.pdf' }], dl: '快消品进销存演示案例.pbix' },
  { color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: 'fa-rotate', tag: 'RETENTION · LTV', title: '复购与留存分析', desc: '复购专题双报告：销售趋势、留存、新增/复购拆解，以及母婴店铺「黄金60天」转化归因，核心度量以 DAX 实现。', tech: ['Power BI', 'DAX', '归因分析'], docs: [{ label: '演示案例', href: '复购分析案例.pdf' }, { label: '分析报告', href: '复购案例分析.pdf' }], dl: '复购分析案例.pbix' }
];
let _caseFiltered = null;
function renderCases(filter = '') {
  const g = document.getElementById('caseGrid');
  let list = CASES;
  if (filter && filter.trim()) {
    const f = filter.trim().toLowerCase();
    list = CASES.filter(c =>
      c.title.toLowerCase().includes(f) ||
      c.desc.toLowerCase().includes(f) ||
      c.tech.some(t => t.toLowerCase().includes(f)) ||
      c.tag.toLowerCase().includes(f)
    );
  }
  if (!list.length) { g.innerHTML = '<div class="no-result">没有找到匹配的项目案例</div>'; return; }
  g.innerHTML = list.map((c, i) => `
    <div class="case case--row">
      <div class="case-cover" style="background:${c.color}" data-doc0="${c.docs[0] ? c.docs[0].href : ''}">
        <i class="fas ${c.icon} ci"></i>
        <span class="big">${String(i + 1).padStart(2, '0')}</span>
        <span class="ctag">${esc(c.tag)}</span>
      </div>
      <div class="case-body">
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.desc)}</p>
        <div class="case-docs">${c.docs.map(d => `<a class="case-doc" href="${esc(d.href)}" target="_blank"><i class="fas fa-external-link-alt"></i> ${esc(d.label)}</a>`).join('')}</div>
        <div class="case-foot">
          <div class="case-tech">${c.tech.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          ${c.dl ? `<a class="case-dl" href="${esc(c.dl)}" download><i class="fas fa-download"></i> 源文件</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}
function doProjSearch(q) { renderCases(q); }
document.getElementById('caseGrid') && document.getElementById('caseGrid').addEventListener('click', e => { const cv = e.target.closest('.case-cover'); if (cv && !e.target.closest('.case-doc') && !e.target.closest('.case-dl') && cv.dataset.doc0) window.open(cv.dataset.doc0, '_blank'); });

/* ===== 证书 ===== */
const CERTS = [{ n: 'CDA 数据分析师', s: 'LEVEL-1', img: './certs/CDA-LEVEL1.jpg' }, { n: 'Office 计算机', s: '二级证书', img: './certs/office_level2.jpg' }, { n: '英语六级', s: 'CET-6', img: './certs/CET6.jpg' }, { n: '普通话', s: '二甲证书', img: './certs/putonghua.jpg' }];
function renderCerts() { document.getElementById('certGrid').innerHTML = CERTS.map(c => `<div class="cert" data-img="${esc(c.img)}"><div class="thumb"><img src="${esc(c.img)}" alt="${esc(c.n)}" loading="lazy"><div class="zoom"><i class="fas fa-expand"></i> 查看大图</div></div><div class="cn">${esc(c.n)}<small>${esc(c.s)}</small></div></div>`).join(''); }
document.getElementById('certGrid') && document.getElementById('certGrid').addEventListener('click', e => { const el = e.target.closest('[data-img]'); if (el) openLB(el.dataset.img); });
function openLB(src) { document.getElementById('lbImg').src = src; document.getElementById('lightbox').classList.add('on'); lockScroll(true); }

/* ===== 学习成长：示例兜底 + 乐观池 ===== */
const GRADS = ['linear-gradient(135deg,#e8730c,#ff9d4d)', 'linear-gradient(135deg,#2f6fed,#5b8def)', 'linear-gradient(135deg,#1f9d63,#46c98a)', 'linear-gradient(135deg,#8b5cf6,#a78bfa)'];
const SEED_LEARNING = [
  { id: 'seed-1', title: '我用 RFM 把 10 万用户分成 8 类，召回效率翻了一倍', content: '刚入职时运营问我"哪些用户该发券"，我下意识拉消费 Top。后来才懂：高消费不等于该召回——昨天刚买的人发券纯属浪费。\n\nRFM 三维度=三句人话：R 多久没来、F 来得勤不勤、M 花得多不多。\n\n最大坑：阈值用均值，被大户带偏；改分位数后分层稳多了。\n\n方法论的价值在于可迁移——换家公司，字段对上，框架照样跑。', images: [], links: [{ text: 'RFM 模型维基百科', url: 'https://en.wikipedia.org/wiki/RFM_(market_research)' }], tags: ['RFM', 'Python', '用户分层'], emoji: '🎯', created_at: '2026-07-18T09:00:00Z' },
  { id: 'seed-2', title: 'SQL 窗口函数：从看不懂到离不开的 30 天', content: '第一次见 OVER (PARTITION BY ... ORDER BY ...) 是懵的。直到理解成"在每组里按时间排好队，再回头看"，瞬间通了。\n\n三个常用场景：取每组最新一条用 ROW_NUMBER；环比用 LAG；累计用 SUM() OVER (ORDER BY ...)。\n\n练习法：别只看书，出 20 道业务真题，写不出就看答案，但一定自己敲一遍。', images: [], links: [{ text: 'PostgreSQL 窗口函数教程', url: 'https://www.postgresqltutorial.com/postgresql-window-function/' }], tags: ['SQL', '窗口函数', '复盘'], emoji: '🪟', created_at: '2026-07-10T09:00:00Z' },
  { id: 'seed-3', title: '数据分析里我踩过的 5 个认知坑', content: '一年前我还在为 VLOOKUP 焦虑。今天聊的不是函数，是差点让我放弃的认知坑。\n\n1 把"会工具"当"会分析"。2 一上来就建模。3 不敢问业务。4 报告写给自己看。5 只输入不输出。\n\n这个博客就是逼自己输出的产物——写出来，才算真的会。这条路不卷速度，卷持续。', images: [], links: [], tags: ['转行', '成长', '随笔'], emoji: '🌱', created_at: '2026-06-28T09:00:00Z' }
];
let learningList = [], _lp = null;
const LR_KEY = 'chi_lr_drafts';
const getLR = () => { try { const r = JSON.parse(localStorage.getItem(LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setLR = a => localStorage.setItem(LR_KEY, JSON.stringify(a));

async function loadLearning() {
  if (_lp) return _lp; return _lp = (async () => {
    let cloud = null;
    if (sb) {
      try { const res = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!res.error && res.data) cloud = res.data; } catch (e) { }
      if (cloud !== null) {
        const drafts = getLR(); if (drafts.length) { const remain = []; for (const x of drafts) { let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, emoji: x.emoji || '📝', files: x.files || [] }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } setLR(remain); if (remain.length !== drafts.length) { try { const r2 = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r2.error && r2.data) cloud = r2.data; } catch (e) { } } }
      }
    }
    const cloudArr = cloud ? cloud.map(p => ({ ...p, emoji: p.emoji || '📝' })) : null;
    const useSeed = !cloudArr || cloudArr.length === 0; const base = (cloudArr || []).concat(useSeed ? SEED_LEARNING : []);
    const postedLR = getPostedLR().map(x => ({ ...x, _posted: true }));
    learningList = sortPosts([...base, ...getLR().map(x => ({ ...x, _local: true })), ...postedLR]);
    learningList = applyLocalOverlay(learningList);
    learningList = dedupeLearning(learningList);
    return { ok: true };
  })();
}
function invalidateLearning() { _lp = null; }

function cardHTML(p, i) {
  const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
  const tags = (p.tags || []).slice(0, 4).map(t => `<span>${esc(t)}</span>`).join('');
  const ex = (p.content || '').replace(/<[^>]+>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\n+/g, ' ').trim().slice(0, 120);
  const pinned = isPinned(p) ? `<span class="pin-flag">📌 置顶</span>` : '';
  const localFlag = p._local ? `<span class="draft-flag">📴 本机</span>` : '';
  const mgmt = `
    <div class="pc-mgmt">
      ${p._local ? `<button class="pc-m sync-btn" data-sync="${esc(String(p.id))}" title="同步到云端"><i class="fas fa-sync-alt"></i></button>` : ''}
      <button class="pc-m" data-edit="${esc(String(p.id))}" title="编辑"><i class="fas fa-pen"></i></button>
      <button class="pc-m pc-m-del" data-del="${esc(String(p.id))}" data-local="${p._local ? '1' : '0'}" title="删除"><i class="fas fa-trash"></i></button>
    </div>
  `;
  return `
    <div class="postcard postcard--row" data-id="${esc(String(p.id))}">
      <div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '📝'}</span></div>
      <div class="pc-main">
        <div class="pc-top">
          <span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>
          ${pinned}${localFlag}
        </div>
        <h3 class="pc-title">${esc(p.title || '无标题')}</h3>
        <p class="pc-ex">${esc(ex)}</p>
        <div class="pc-tags">${tags}</div>
      </div>
      ${mgmt}
    </div>
  `;
}

let _lrSearchCache = '';
function renderLearningList(filter = '') {
  const g = document.getElementById('learningGrid');
  let list = learningList;
  if (filter && filter.trim()) {
    const f = filter.trim().toLowerCase();
    list = learningList.filter(p =>
      (p.title || '').toLowerCase().includes(f) ||
      (p.content || '').toLowerCase().includes(f) ||
      (p.tags || []).some(t => t.toLowerCase().includes(f))
    );
  }
  if (!list.length) { g.innerHTML = '<div class="no-result">' + (filter ? '没有匹配的学习笔记' : '还没有学习记录，写第一篇吧 ✍️') + '</div>'; return; }
  g.innerHTML = list.map(cardHTML).join('');
}
function doLearningSearch(q) { _lrSearchCache = q; renderLearningList(q); }

function renderHomeLatest() {
  const list = learningList.slice(0, 4);
  const h = document.getElementById('homeLatestH'), g = document.getElementById('homeLatest'), m = document.getElementById('homeLatestMore');
  if (!list.length) { if (h) h.style.display = 'none'; g.innerHTML = ''; if (m) m.style.display = 'none'; return; }
  if (h) h.style.display = 'flex'; if (m) m.style.display = 'flex'; g.innerHTML = list.map(cardHTML).join('');
}

async function resyncOne(id) { const d = getLR(); const x = d.find(a => a.id === id); if (!x || !sb) return; let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const files = await migrateFilesToStorage(x.files); const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, emoji: x.emoji || '📝', files: files }), 15000); ok = !r.error; } catch (e) { } if (ok) { setLR(d.filter(a => a.id !== id)); invalidateLearning(); await loadLearning(); renderLearningList(_lrSearchCache); renderHomeLatest(); showToast('已同步到云端 ✓'); } else showToast('同步失败，稍后再试（内容仍安全存在本机）'); }

async function migrateFilesToStorage(files) {
  if (!sb || !files || !files.length) return files || [];
  const out = [];
  for (const f of files) {
    if (!f || !f._base64 || !f.url || !f.url.startsWith('data:')) { out.push(f); continue; }
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      const fileObj = new File([blob], f.name || 'file', { type: f.type || 'application/octet-stream' });
      const meta = await uploadFileToStorage(fileObj);
      out.push(meta);
    } catch (e) { out.push(f); }
  }
  return out;
}

function renderRead(p, preview) {
  const tags = (p.tags || []).map(t => `<span class="mtag">${esc(t)}</span>`).join('');
  const imgs = p.images || [];
  const gallery = imgs.length ? `<div class="article-gallery">${imgs.map(s => `<div class="gal-item" data-img="${esc(s)}"><img src="${esc(s)}" alt=""></div>`).join('')}</div>` : '';
  const links = p.links || [];
  const refs = links.length ? `<div class="article-refs"><h4><i class="fas fa-link"></i> 参考链接</h4>${links.map(l => `<a class="ref-card" href="${esc(l.url)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i><span><b>${esc(l.text || '链接')}</b><small>${esc(l.url)}</small></span><i class="fas fa-arrow-right"></i></a>`).join('')}</div>` : '';
  // 附件渲染
  const files = p.files || [];
  const fileSec = files.length ? `<div class="article-refs"><h4><i class="fas fa-paperclip"></i> 附件下载</h4>${files.map(f => {
    const name = esc(f.name || '附件');
    const url = esc(f.url || '#');
    const size = f.size ? `(${(f.size / 1024 / 1024).toFixed(1)} MB)` : '';
    return `<a class="ref-card" href="${url}" target="_blank" download="${name}"><i class="fas fa-file"></i><span><b>${name}</b><small>${size}</small></span><i class="fas fa-download"></i></a>`;
  }).join('')}</div>` : '';

  let nav = '';
  if (!preview) {
    const idx = learningList.findIndex(a => String(a.id) === String(p.id));
    const newer = idx > 0 ? learningList[idx - 1] : null; const older = idx >= 0 && idx < learningList.length - 1 ? learningList[idx + 1] : null;
    const card = (a, dir, cls) => a ? `<div class="an ${cls}" data-id="${esc(String(a.id))}"><i class="fas fa-arrow-${dir === 'left' ? 'left' : 'right'}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>${esc(a.title || '无标题')}</b></span></div>` : `<div class="an disabled"><i class="fas fa-arrow-${dir === 'left' ? 'left' : 'right'}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>没有了</b></span></div>`;
    nav = `<div class="article-nav">${card(older, 'left', '')}${card(newer, 'right', 'next')}</div>`;
  }
  const localBar = p._local ? `<div class="preview-bar"><i class="fas fa-wifi-slash"></i> 这篇还在本机，联网后会自动同步。<button class="btn btn-ghost rb-btn" id="syncNow"><i class="fas fa-sync-alt"></i> 立即同步</button></div>` : '';
  const bar = preview ? `<div class="preview-bar"><i class="fas fa-eye"></i> 这是预览，尚未发布。<button class="btn btn-ghost rb-btn" id="backEdit"><i class="fas fa-arrow-left"></i> 返回编辑</button></div>` : `<div class="read-bar"><span class="back-link" id="backList"><i class="fas fa-arrow-left"></i> 返回学习成长</span><span class="rb-spacer"></span><button class="btn btn-ghost rb-btn" id="editCur"><i class="fas fa-pen"></i> 编辑</button><button class="btn btn-ghost rb-btn rb-del" id="delCur"><i class="fas fa-trash"></i> 删除</button></div>`;
  document.getElementById('readInner').innerHTML = `${bar}${localBar}
    <h1 class="article-title">${esc(p.title || '无标题')}</h1>
    <div class="article-meta">${fmtDate(p.created_at || new Date().toISOString())}${tags}</div>
    <div class="article-body">${(window.__isHTML && window.__isHTML(p.content)) ? p.content : toRTEHTML(p.content || '')}</div>
    ${gallery}${fileSec}${refs}${nav}`;
  document.getElementById('readInner').querySelectorAll('.gal-item').forEach(g => g.onclick = () => openLB(g.dataset.img));
  const bl = document.getElementById('backList'); if (bl) bl.onclick = () => go('learning');
  const be = document.getElementById('backEdit'); if (be) be.onclick = () => go('learning');
  const sn = document.getElementById('syncNow'); if (sn) sn.onclick = () => resyncOne(p.id);
  const ec = document.getElementById('editCur'); if (ec) ec.onclick = () => editLearning(p.id);
  const dc = document.getElementById('delCur'); if (dc) dc.onclick = () => deleteLearning(p.id, !!p._local);
  document.getElementById('readInner').querySelectorAll('.an[data-id]').forEach(a => a.onclick = () => go('read/' + a.dataset.id));
}

/* ===== 学习成长：编辑器 ===== */
let lrImages = [], lrLinks = [], lrFiles = [];
let editingId = null, editingLocal = false;
function setEditorMode(on) { const pub = document.getElementById('lrPub'); pub.innerHTML = on ? '<i class="fas fa-save"></i> 保存修改' : '<i class="fas fa-paper-plane"></i> 发布'; let cb = document.getElementById('lrCancel'); if (on && !cb) { pub.insertAdjacentHTML('afterend', '<button class="btn btn-ghost" id="lrCancel" style="margin-left:8px"><i class="fas fa-times"></i> 取消</button>'); document.getElementById('lrCancel').onclick = clearEditor; } else if (!on && cb) cb.remove(); }
function clearEditor() { editingId = null; editingLocal = false; document.getElementById('lrTitle').value = ''; if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; lrFiles = []; renderThumbs(); renderLinkList(); renderAttachments(); setEditorMode(false); }
function editLearning(id) { const p = learningList.find(a => String(a.id) === String(id)); if (!p) return; editingId = String(id); editingLocal = !!p._local; document.getElementById('lrTitle').value = p.title || ''; if (window.__rte) window.__rte.ed.innerHTML = toRTEHTML(p.content || ''); else document.getElementById('lrContent').value = p.content || ''; document.getElementById('lrTags').value = (p.tags || []).join(', '); lrImages = (p.images || []).slice(); renderThumbs(); lrFiles = (p.files || []).slice(); renderAttachments(); lrLinks = (p.links || []).map(l => ({ text: l.text, url: l.url })); renderLinkList(); setEditorMode(true); showView('learning'); setNav('learning'); setTimeout(() => document.getElementById('lrTitle').scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); showToast('已进入编辑模式 · 改完点「保存修改」'); }

/* ===== 本机小账本：示例文的隐藏/覆盖 ===== */
const HIDE_KEY = 'chi_lr_hide', EDIT_KEY = 'chi_lr_edit';
const getHide = () => { try { const r = JSON.parse(localStorage.getItem(HIDE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setHide = a => localStorage.setItem(HIDE_KEY, JSON.stringify(a));
const getEdit = () => { try { const r = JSON.parse(localStorage.getItem(EDIT_KEY)); return r && typeof r === 'object' ? r : {}; } catch (e) { return {}; } };
const setEdit = o => localStorage.setItem(EDIT_KEY, JSON.stringify(o));
function applyLocalOverlay(arr) { const hide = getHide(); const ov = getEdit(); return arr.filter(p => !hide.includes(String(p.id))).map(p => { const o = ov[String(p.id)]; if (!o) return p; return Object.assign({}, p, { title: o.title, content: o.content, images: o.images, links: o.links, tags: o.tags, files: o.files }); }); }

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
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').delete().eq('id', sid), 12000); ok = !r.error; } catch (e) { } } if (!ok) { const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h); invalidateLearning(); await loadLearning(); renderLearningList(_lrSearchCache); renderHomeLatest(); if (curHash().startsWith('read/')) go('learning'); showToast('已在本机移除 ✓（云端副本需开删除权限才能彻底抹掉）'); return; }
  } else { const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h); }
  invalidateLearning(); await loadLearning(); renderLearningList(_lrSearchCache); renderHomeLatest();
  if (curHash().startsWith('read/')) go('learning');
  showToast('已删除 ✓');
}

function renderThumbs() {
  document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => {
    if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--panel-2);color:var(--ink-3);font-size:12px">上传中</div>`;
    return `<div class="lr-thumb"><img src="${esc(s)}" alt=""><button onclick="lrImages.splice(${i},1);renderThumbs()" title="移除"><i class="fas fa-times"></i></button></div>`;
  }).join('');
}
function renderAttachments() {
  const el = document.getElementById('lrAttachments');
  if (!el) return;
  el.innerHTML = lrFiles.map((f, i) => {
    if (f && typeof f === 'object' && f._uploading) return `<div class="lr-attach-item uploading"><i class="fas fa-spinner fa-spin"></i> ${esc(f.name)} 上传中…</div>`;
    const name = esc(f.name || '附件');
    const size = f.size ? `(${(f.size / 1024 / 1024).toFixed(1)} MB)` : '';
    return `<div class="lr-attach-item"><i class="fas fa-file"></i> <span>${name} <small>${size}</small></span> <button onclick="lrFiles.splice(${i},1);renderAttachments()" title="移除"><i class="fas fa-times"></i></button></div>`;
  }).join('');
}
function renderLinkList() {
  document.getElementById('lrLinks').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><i class="fas fa-link lk"></i><span class="lt">${esc(l.text)}<small>${esc(l.url)}</small></span><button onclick="lrLinks.splice(${i},1);renderLinkList()"><i class="fas fa-times"></i></button></div>`).join('');
}
function addLink() { const t = document.getElementById('lrLinkText').value.trim(), u = document.getElementById('lrLinkURL').value.trim(); if (!t || !u) return; lrLinks.push({ text: t, url: u }); document.getElementById('lrLinkText').value = ''; document.getElementById('lrLinkURL').value = ''; renderLinkList(); }

async function publishLearning() {
  const title = document.getElementById('lrTitle').value.trim();
  const content = window.__rte ? window.__rte.html() : document.getElementById('lrContent').value;
  const tags = document.getElementById('lrTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  if (!title) { showToast('请填写标题'); document.getElementById('lrTitle').focus(); return; }
  if (!content.trim()) { showToast('请填写正文'); return; }
  const payload = { title, content, images: lrImages, links: lrLinks, tags, emoji: '📝', files: lrFiles };
  if (editingId) {
    if (editingLocal) {
      const d = getLR().map(x => String(x.id) === editingId ? { ...x, ...payload, id: editingId } : x);
      setLR(d);
    } else {
      const ov = getEdit(); ov[editingId] = payload; setEdit(ov);
    }
    invalidateLearning(); await loadLearning(); renderLearningList(_lrSearchCache); renderHomeLatest();
    showToast('已保存修改 ✓'); clearEditor(); return;
  }
  const id = uid('LR');
  const item = { ...payload, id, created_at: new Date().toISOString(), _local: true };
  setLR([item, ...getLR()]);
  invalidateLearning(); learningList = sortPosts([...learningList, item]); learningList = dedupeLearning(learningList);
  renderLearningList(_lrSearchCache); renderHomeLatest();
  clearEditor();
  showToast('已保存到本机 ✓（联网后自动同步云端）');
  if (sb) { try { const migrated = await migrateImagesToStorage(lrImages); const files = await migrateFilesToStorage(lrFiles); const r = await withTimeout(sb.from('learning').insert({ title, content, images: migrated, links: lrLinks, tags, emoji: '📝', files }), 15000); if (!r.error) { invalidateLearning(); await loadLearning(); renderLearningList(_lrSearchCache); renderHomeLatest(); showToast('已同步到云端 ✓'); } } catch (e) { } }
}

/* ===== 附件上传事件 ===== */
document.getElementById('lrFileIn').addEventListener('change', async e => {
  const files = e.target.files;
  if (!files.length) return;
  for (const file of files) {
    await processFileUpload(file, lrFiles, renderAttachments);
  }
  e.target.value = '';
});

/* ===== 图片上传事件 ===== */
document.getElementById('lrImgIn').addEventListener('change', async e => {
  const files = e.target.files;
  if (!files.length) return;
  for (const file of files) {
    await processImageUpload(file, lrImages, renderThumbs);
  }
  e.target.value = '';
});

/* ===== 富文本编辑器 ===== */
function initRTE(barId, edId, opts = {}) {
  const bar = document.getElementById(barId);
  const ed = document.getElementById(edId);
  if (!bar || !ed) return null;
  const cmds = [
    { cmd: 'bold', icon: 'fa-bold', tip: '加粗' },
    { cmd: 'italic', icon: 'fa-italic', tip: '斜体' },
    { cmd: 'underline', icon: 'fa-underline', tip: '下划线' },
    { cmd: 'strikeThrough', icon: 'fa-strikethrough', tip: '删除线' },
    { sep: true },
    { cmd: 'insertUnorderedList', icon: 'fa-list-ul', tip: '无序列表' },
    { cmd: 'insertOrderedList', icon: 'fa-list-ol', tip: '有序列表' },
    { sep: true },
    { cmd: 'formatBlock', val: 'BLOCKQUOTE', icon: 'fa-quote-left', tip: '引用' },
    { cmd: 'insertHorizontalRule', icon: 'fa-minus', tip: '分割线' },
    { sep: true },
    { cmd: 'removeFormat', icon: 'fa-eraser', tip: '清除格式' },
  ];
  bar.innerHTML = cmds.map(c => c.sep ? '<span class="rte-sep"></span>' : `<button class="rte-b" title="${c.tip}" data-cmd="${c.cmd}"${c.val ? ' data-val="' + c.val + '"' : ''}><i class="fas ${c.icon}"></i></button>`).join('');
  bar.querySelectorAll('button[data-cmd]').forEach(b => {
    b.addEventListener('click', e => { e.preventDefault(); const cmd = b.dataset.cmd, val = b.dataset.val || null; document.execCommand(cmd, false, val); ed.focus(); });
  });
  ed.contentEditable = true;
  ed.addEventListener('paste', e => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  const updateEmpty = () => { if (!ed.textContent.trim() && !ed.querySelector('img')) ed.classList.add('is-empty'); else ed.classList.remove('is-empty'); };
  ed.addEventListener('input', updateEmpty);
  updateEmpty();
  return {
    html: () => ed.innerHTML,
    clear: () => { ed.innerHTML = ''; updateEmpty(); },
    ed
  };
}

/* ===== 生活随笔 ===== */
const SEED_LIFE = [];
let lifeList = [], cloudOK = false;
const LIFE_KEY = 'chi_posts';
function loadLocal() { try { const r = JSON.parse(localStorage.getItem(LIFE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } }
function saveLocal(a) { localStorage.setItem(LIFE_KEY, JSON.stringify(a)); }

async function loadPosts() {
  if (!sb) { cloudOK = false; return; }
  try {
    const res = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(200), 6000);
    if (res.error || !res.data) { cloudOK = false; return; }
    cloudOK = true;
    const cloud = res.data;
    const local = loadLocal();
    const merged = [...cloud];
    const have = new Set(cloud.map(p => normTxt(p.content)));
    for (const p of local) { if (!have.has(normTxt(p.content))) merged.push(p); }
    const sets = lifeHideSets();
    lifeList = sortPosts(merged).filter(p => !lifeIsHiddenObj(p, sets));
    lifeList = dedupeLife(lifeList);
    saveLocal(lifeList);
    confirmPostedArr(getPostedLife(), cloud, 'content', setPostedLife);
  } catch (e) { cloudOK = false; }
}

let _lifeSearchCache = '';
function renderPosts(arr, showMode) {
  const g = document.getElementById('postList');
  let list = arr;
  if (_lifeSearchCache && _lifeSearchCache.trim()) {
    const f = _lifeSearchCache.trim().toLowerCase();
    list = arr.filter(p =>
      (contentOf(p) || '').toLowerCase().includes(f) ||
      (p.tags || []).some(t => t.toLowerCase().includes(f))
    );
  }
  if (!list.length) { g.innerHTML = '<div class="no-result">' + (_lifeSearchCache ? '没有匹配的随笔' : '还没有随笔，发一条吧 ✍️') + '</div>'; injectExportBtn(); return; }
  g.innerHTML = list.map(p => {
    const content = contentOf(p);
    const isHTML = window.__isHTML && window.__isHTML(content);
    const txt = isHTML ? content : linkify(content);
    const imgs = (p.images || []).map(s => `<img class="limg" src="${esc(s)}" data-img="${esc(s)}" alt="">`).join('');
    const tags = (p.tags || []).map(t => `<span>${esc(t)}</span>`).join('');
    const mode = showMode ? '<span class="post-mode"><i class="fas fa-wifi-slash"></i> 本机暂存</span>' : (cloudOK ? '<span class="post-mode live"><i class="fas fa-check-circle"></i> 已同步</span>' : '<span class="post-mode"><i class="fas fa-wifi-slash"></i> 离线</span>');
    const mgmt = `<div class="life-mgmt"><button data-life-edit="${esc(String(p.id))}" title="编辑"><i class="fas fa-pen"></i></button><button data-life-del="${esc(String(p.id))}" data-local="${p._local ? '1' : '0'}" title="删除"><i class="fas fa-trash"></i></button></div>`;
    return `<div class="post">
      <div class="ph"><div class="pav">历</div><div class="pinfo"><span class="who">阿历</span> <span class="when">${fmtDate(p.created_at || new Date().toISOString())}</span></div>${mode}${mgmt}</div>
      <div class="ptxt${isHTML ? '-html' : ''}">${isHTML ? txt : txt.replace(/\n/g, '<br>')}</div>
      ${imgs}<div class="ptags">${tags}</div>
    </div>`;
  }).join('');
  injectExportBtn();
}
function doLifeSearch(q) { _lifeSearchCache = q; renderPosts(lifeList, false); }

function renderHomeLife() {
  const g = document.getElementById('homeLife');
  if (!g) return;
  const list = lifeList.slice(0, 3);
  if (!list.length) { g.innerHTML = '<p style="color:var(--ink-3)">还没有随笔，去生活随笔页面发一条吧 ✍️</p>'; return; }
  g.innerHTML = list.map(p => {
    const content = contentOf(p);
    const isHTML = window.__isHTML && window.__isHTML(content);
    const txt = isHTML ? content : linkify(content);
    const imgs = (p.images || []).slice(0, 1).map(s => `<img class="limg" src="${esc(s)}" data-img="${esc(s)}" alt="">`).join('');
    const tags = (p.tags || []).map(t => `<span>${esc(t)}</span>`).join('');
    return `<div class="post" style="cursor:pointer" onclick="go('life')">
      <div class="ph"><div class="pav">历</div><div class="pinfo"><span class="who">阿历</span> <span class="when">${fmtDate(p.created_at || new Date().toISOString())}</span></div></div>
      <div class="ptxt${isHTML ? '-html' : ''}">${isHTML ? txt : txt.replace(/\n/g, '<br>')}</div>
      ${imgs}<div class="ptags">${tags}</div>
    </div>`;
  }).join('');
}

let lifeImages = [];
function renderLifeThumbs() {
  document.getElementById('lifeThumbs').innerHTML = lifeImages.map((s, i) => `<div class="lr-thumb"><img src="${esc(s)}" alt=""><button onclick="lifeImages.splice(${i},1);renderLifeThumbs()" title="移除"><i class="fas fa-times"></i></button></div>`).join('');
}
document.getElementById('lifeImgIn').addEventListener('change', async e => {
  const files = e.target.files; if (!files.length) return;
  for (const file of files) { await processImageUpload(file, lifeImages, renderLifeThumbs); }
  e.target.value = '';
});

async function publishLife() {
  const content = window.__lifeRTE ? window.__lifeRTE.html() : document.getElementById('lifeContent').value;
  const tags = document.getElementById('lifeTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  if (!content.trim() && !lifeImages.length) { showToast('写点什么或配张图再发吧'); return; }
  const payload = { content, tags, images: lifeImages };
  const id = uid('LF');
  const item = { ...payload, id, created_at: new Date().toISOString(), _local: true };
  const posted = getPostedLife();
  posted.unshift(item);
  setPostedLife(posted);
  lifeList = sortPosts([...lifeList, item]);
  lifeList = dedupeLife(lifeList);
  renderPosts(lifeList, false); renderHomeLife();
  document.getElementById('lifeTags').value = '';
  if (window.__lifeRTE) window.__lifeRTE.clear(); else document.getElementById('lifeContent').value = '';
  lifeImages = []; renderLifeThumbs();
  showToast('已发布 ✓（先存本机，联网后自动同步）');
  if (sb) {
    try {
      const migrated = await migrateImagesToStorage(lifeImages);
      const r = await withTimeout(sb.from('posts').insert({ content, tags, images: migrated }), 15000);
      if (!r.error) { loadPosts().then(() => { renderPosts(lifeList, false); renderHomeLife(); }); showToast('已同步到云端 ✓'); }
    } catch (e) { }
  }
}

function editLife(id) {
  const p = lifeList.find(a => String(a.id) === String(id));
  if (!p) return;
  const content = contentOf(p);
  if (window.__lifeRTE) window.__lifeRTE.ed.innerHTML = toRTEHTML(content);
  else document.getElementById('lifeContent').value = content;
  document.getElementById('lifeTags').value = (p.tags || []).join(', ');
  lifeImages = (p.images || []).slice();
  renderLifeThumbs();
  showView('life'); setNav('life');
  setTimeout(() => document.getElementById('lifeRTE').scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  showToast('已进入编辑模式 · 修改后重新发布即可覆盖');
}

async function deleteLife(id, isLocal) {
  if (!confirm('确定删除这条随笔？此操作不可撤销。')) return;
  const sid = String(id);
  const target = lifeList.find(a => String(a.id) === sid);
  const delKey = normTxt(target ? contentOf(target) : '');
  const match = x => String(x.id) === sid || (delKey !== '' && normTxt(contentOf(x)) === delKey);
  const pp = getPostedLife(); if (pp.some(match)) setPostedLife(pp.filter(x => !match(x)));
  if (isLocal) { saveLocal(loadLocal().filter(x => !match(x))); }
  else if (sb) {
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('posts').delete().eq('id', sid), 12000); ok = !r.error; } catch (e) { } }
    if (!ok) { addLifeHideC(delKey); }
  } else { addLifeHideC(delKey); }
  await loadPosts(); renderPosts(lifeList, false); renderHomeLife();
  showToast('已删除 ✓');
}

/* ===== 归档汇总 ===== */
let _archiveTab = 'all';
let _archiveSearch = '';

function switchArchiveTab(tab) {
  _archiveTab = tab;
  document.querySelectorAll('.archive-tab').forEach(b => b.classList.toggle('active', b.textContent.includes(tab === 'all' ? '全部' : tab === 'learning' ? '学习' : tab === 'life' ? '随笔' : tab === 'project' ? '项目' : '标签')));
  renderArchive();
}

function renderArchive() {
  const g = document.getElementById('archiveResults');
  const q = (_archiveSearch || '').trim().toLowerCase();

  // 收集所有内容
  let allItems = [];

  // 学习成长
  learningList.forEach(p => {
    allItems.push({ type: 'learning', title: p.title || '无标题', content: contentOf(p), tags: p.tags || [], date: p.created_at, id: p.id, emoji: p.emoji || '📝', obj: p });
  });

  // 生活随笔
  lifeList.forEach(p => {
    allItems.push({ type: 'life', title: contentOf(p).slice(0, 60) || '随笔', content: contentOf(p), tags: p.tags || [], date: p.created_at, id: p.id, emoji: '🌱', obj: p });
  });

  // 项目案例
  CASES.forEach((c, i) => {
    allItems.push({ type: 'project', title: c.title, content: c.desc, tags: c.tech, date: null, id: 'case-' + i, emoji: '💼', obj: c });
  });

  // 筛选
  if (_archiveTab !== 'all' && _archiveTab !== 'tag') {
    allItems = allItems.filter(it => it.type === _archiveTab);
  }

  if (q) {
    allItems = allItems.filter(it =>
      (it.title || '').toLowerCase().includes(q) ||
      (it.content || '').toLowerCase().includes(q) ||
      it.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // 按标签分类模式
  if (_archiveTab === 'tag') {
    const tagMap = {};
    allItems.forEach(it => {
      it.tags.forEach(t => {
        if (!tagMap[t]) tagMap[t] = [];
        tagMap[t].push(it);
      });
    });
    const sortedTags = Object.keys(tagMap).sort();
    if (!sortedTags.length) { g.innerHTML = '<div class="no-result">暂无标签数据</div>'; return; }
    g.innerHTML = sortedTags.map(tag => {
      const items = tagMap[tag];
      return `<div class="archive-folder">
        <div class="archive-folder-h"><span class="archive-folder-icon">🏷️</span> <b>${esc(tag)}</b> <span class="archive-folder-count">${items.length}</span></div>
        <div class="archive-folder-items">${items.map(it => archiveItemHTML(it)).join('')}</div>
      </div>`;
    }).join('');
    return;
  }

  // 时间线模式
  allItems.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  if (!allItems.length) { g.innerHTML = '<div class="no-result">没有找到内容</div>'; return; }

  // 按年月分组
  let currentYM = '';
  let html = '';
  allItems.forEach(it => {
    const d = it.date ? new Date(it.date) : null;
    const ym = d ? `${d.getFullYear()}年${d.getMonth() + 1}月` : '项目案例';
    if (ym !== currentYM) {
      if (currentYM) html += '</div>';
      currentYM = ym;
      html += `<div class="archive-folder"><div class="archive-folder-h"><span class="archive-folder-icon">📁</span> <b>${esc(ym)}</b></div><div class="archive-folder-items">`;
    }
    html += archiveItemHTML(it);
  });
  if (currentYM) html += '</div></div>';
  g.innerHTML = html;
}

function archiveItemHTML(it) {
  const dateStr = it.date ? fmtDate(it.date) : '';
  const typeLabel = it.type === 'learning' ? '📚' : it.type === 'life' ? '🌱' : '💼';
  const onclick = it.type === 'learning' ? `go('read/${esc(String(it.id))}')` : it.type === 'life' ? `go('life')` : `window.open('${esc(it.obj.docs && it.obj.docs[0] ? it.obj.docs[0].href : '#')}', '_blank')`;
  const tags = it.tags.slice(0, 3).map(t => `<span class="archive-tag">${esc(t)}</span>`).join('');
  return `<div class="archive-item" onclick="${onclick}">
    <span class="archive-item-emoji">${typeLabel}</span>
    <div class="archive-item-main">
      <div class="archive-item-title">${esc(it.title)}</div>
      <div class="archive-item-meta">${dateStr} ${tags}</div>
    </div>
    <i class="fas fa-chevron-right archive-item-arrow"></i>
  </div>`;
}

function doArchiveSearch(q) {
  _archiveSearch = q;
  renderArchive();
}

/* ===== 主题切换 ===== */
const themeBtn = document.getElementById('themeBtn');
function applyTheme() {
  const dark = localStorage.getItem('chi_theme') === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  themeBtn.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}
themeBtn.addEventListener('click', () => { const dark = localStorage.getItem('chi_theme') === 'dark'; localStorage.setItem('chi_theme', dark ? '' : 'dark'); applyTheme(); });
applyTheme();

/* ===== 离线模式 ===== */
const offlineBtn = document.getElementById('offlineBtn');
let offlineMode = localStorage.getItem('chi_offline') === '1';
function setOffline(on) {
  offlineMode = on;
  localStorage.setItem('chi_offline', on ? '1' : '');
  offlineBtn.classList.toggle('off', on);
  offlineBtn.innerHTML = on ? '<i class="fas fa-plane"></i>' : '<i class="fas fa-wifi"></i>';
  const t = document.getElementById('offToast');
  if (on) { t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
}
offlineBtn.addEventListener('click', () => setOffline(!offlineMode));
if (offlineMode) setOffline(true);

/* ===== 回到顶部 ===== */
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => { toTop.classList.toggle('show', window.scrollY > 400); }, { passive: true });
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ===== 时钟 & 日期 ===== */
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
}
setInterval(updateClock, 1000); updateClock();

function getLunarDate(d) {
  const lunarInfo = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977];
  const Gan = "甲乙丙丁戊己庚辛壬癸", Zhi = "子丑寅卯辰巳午未申酉戌亥";
  const Animals = "鼠牛虎兔龙蛇马羊猴鸡狗猪";
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const baseDate = new Date(1900, 0, 31);
  const offset = Math.floor((d - baseDate) / 86400000);
  let i, leap = 0, temp = 0;
  for (i = 1900; i < 2100 && offset > 0; i++) { temp = lYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  const lunarYear = i;
  leap = leapMonth(i);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) { --i; isLeap = true; temp = leapDays(lunarYear); }
    else { temp = monthDays(lunarYear, i); }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) { if (isLeap) { isLeap = false; } else { isLeap = true; --i; } }
  if (offset < 0) { offset += temp; --i; }
  const lunarMonth = i, lunarDay = offset + 1;
  const yearGan = Gan.charAt((lunarYear - 4) % 10), yearZhi = Zhi.charAt((lunarYear - 4) % 12);
  return `${yearGan}${yearZhi}年 · ${lunarMonth}月${lunarDay}日`;
}
function lYearDays(y) { let i, sum = 348; for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0; return sum + leapDays(y); }
function leapDays(y) { if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29; return 0; }
function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

const today = new Date();
document.getElementById('todayDate').innerHTML = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 · 周${'日一二三四五六'.charAt(today.getDay())}`;
try { document.getElementById('lunarDate').textContent = getLunarDate(today); } catch (e) { document.getElementById('lunarDate').textContent = ''; }

/* ===== 初始化 ===== */
window.__rte = initRTE('rteBar', 'lrRTE');
window.__lifeRTE = initRTE('lifeRteBar', 'lifeRTE');
renderCases();
renderCerts();

// 数据找回
try { recoverLifeBackup(collectAllBackupCandidates()); } catch (e) { }

// 路由
window.addEventListener('hashchange', route);
route();

// 键盘快捷键
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    const active = document.querySelector('.view.active');
    if (!active) return;
    if (active.dataset.view === 'learning') publishLearning();
    if (active.dataset.view === 'life') publishLife();
  }
});

console.log('🌱 数字花园已加载');
