/* ===== 云端（带"加载失败也不崩"保险） ===== */
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
function showToast(h, ms = 4200) { toastEl.innerHTML = h; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); document.body.removeChild(a); return ok; } }
function compress(file, max = 1000, q = 0.7) { return new Promise(res => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > max || h > max) { if (w > h) { h = h * max / w; w = max; } else { w = w * max / h; h = max; } } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', q)); }; img.src = r.result; }; r.readAsDataURL(file); }); }

/* ===== 图片上传：优先 Supabase Storage，断网 fallback base64 ===== */
const IMG_BUCKET = 'learning-images';
async function uploadImageToStorage(file) {
  if (!sb) throw new Error('Supabase 未连接');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { data, error } = await sb.storage.from(IMG_BUCKET).upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from(IMG_BUCKET).getPublicUrl(path);
  return publicUrl;
}
async function processImageUpload(file, arr, renderFn) {
  const placeholder = { _uploading: true, name: file.name };
  arr.push(placeholder);
  const idx = arr.length - 1;
  renderFn();
  try {
    if (sb) {
      const url = await uploadImageToStorage(file);
      arr[idx] = url;
    } else {
      arr[idx] = await compress(file);
    }
  } catch (err) {
    console.error('图片上传失败，fallback base64', err);
    try { arr[idx] = await compress(file); }
    catch (e2) { arr.splice(idx, 1); showToast('「' + file.name + '」上传失败'); renderFn(); return; }
  }
  renderFn();
}
async function migrateImagesToStorage(images) {
  const out = [];
  for (const s of images || []) {
    if (!s || typeof s !== 'string' || !s.startsWith('data:image')) { out.push(s); continue; }
    try {
      const res = await fetch(s);
      const blob = await res.blob();
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      const url = await uploadImageToStorage(file);
      out.push(url);
    } catch (e) { out.push(s); }
  }
  return out;
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
const setPostedLife = d => localStorage.setItem(POSTED_LIFE_KEY, JSON.stringify(d));
const getPostedLR = () => { try { const r = JSON.parse(localStorage.getItem(POSTED_LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setPostedLR = d => localStorage.setItem(POSTED_LR_KEY, JSON.stringify(d));
const LIFE_KEY = 'chi_posts_v1'; const getLife = () => { try { const r = JSON.parse(localStorage.getItem(LIFE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setLife = d => localStorage.setItem(LIFE_KEY, JSON.stringify(d));
const LR_KEY = 'chi_lr_v1'; const getLR = () => { try { const r = JSON.parse(localStorage.getItem(LR_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setLR = d => localStorage.setItem(LR_KEY, JSON.stringify(d));
const EDIT_KEY = 'chi_edit_v1'; const getEdit = () => { try { return JSON.parse(localStorage.getItem(EDIT_KEY)) || {}; } catch (e) { return {}; } };
const setEdit = d => localStorage.setItem(EDIT_KEY, JSON.stringify(d));

/* ===== 数据加载 ===== */
let learningList = [], lifeList = [];
async function loadLearning() {
  let cloud = []; if (sb) { try { const r = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r.error && r.data) cloud = r.data; } catch (e) { } }
  const drafts = getLR(); if (drafts.length) { const remain = []; for (const x of drafts) { let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, emoji: x.emoji || '📝' }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } setLR(remain); if (remain.length !== drafts.length) { try { const r2 = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r2.error && r2.data) cloud = r2.data; } catch (e) { } } }
  const pool = getPostedLR(); const merged = mergePosts(cloud, pool); learningList = sortPosts(merged); renderLearningList(); renderHomeLatest();
}
async function loadLife() {
  let cloud = []; if (sb) { try { const r = await withTimeout(sb.from('life').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r.error && r.data) cloud = r.data; } catch (e) { } }
  const drafts = getLife(); if (drafts.length) { const remain = []; for (const x of drafts) { let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('life').insert({ title: x.title, content: x.content, images: migrated, tags: x.tags, emoji: x.emoji || '🌱' }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } setLife(remain); if (remain.length !== drafts.length) { try { const r2 = await withTimeout(sb.from('life').select('*').order('created_at', { ascending: false }).limit(100), 6000); if (!r2.error && r2.data) cloud = r2.data; } catch (e) { } } }
  const pool = getPostedLife(); const merged = mergePosts(cloud, pool); lifeList = sortPosts(merged); renderLifeList(); renderHomeLatest();
}
function mergePosts(cloud, local) { const ids = new Set(cloud.map(c => String(c.id))); const out = [...cloud, ...local.filter(l => !ids.has(String(l.id)))]; return out; }
function invalidateLearning() { learningList = []; }
function invalidateLife() { lifeList = []; }

/* ===== 种子数据 ===== */
const GRADS = ['#ff7a1a','#ffb347','#ff9f43','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4','#ffeaa7'];
const SEED_LEARNING = [
  { id: 'seed-1', title: '我用 RFM 把 10 万用户分成 8 类，召回效率翻了一倍', content: '刚入职时运营问我"哪些用户该发券"，我下意识拉消费 Top。后来才懂：高消费不等于该召回——昨天刚买的人发券纯属浪费。\n\nRFM 三维度=三句人话：R 多久没来、F 来得勤不勤、M 花得多不多。\n\n最大坑：阈值用均值，被大户带偏；改分位数后分层稳多了。\n\n方法论的价值在于可迁移——换家公司，字段对上，框架照样跑。', images: [], links: [{ text: 'RFM 模型维基百科', url: 'https://en.wikipedia.org/wiki/RFM_(market_research)' }], tags: ['RFM', 'Python', '用户分层'], emoji: '🎯', created_at: '2026-07-18T09:00:00Z' },
  { id: 'seed-2', title: 'SQL 窗口函数：从看不懂到离不开的 30 天', content: '第一次见 OVER (PARTITION BY ... ORDER BY ...) 是懵的。直到理解成"在每组里按时间排好队，再回头看"，瞬间通了。\n\n三个常用场景：取每组最新一条用 ROW_NUMBER；环比用 LAG；累计用 SUM() OVER (ORDER BY ...)。\n\n练习法：别只看书，出 20 道业务真题，写不出就看答案，但一定自己敲一遍。', images: [], links: [{ text: 'PostgreSQL 窗口函数教程', url: 'https://www.postgresqltutorial.com/postgresql-window-function/' }], tags: ['SQL', '窗口函数', '复盘'], emoji: '🪟', created_at: '2026-07-10T09:00:00Z' },
  { id: 'seed-3', title: '数据分析里我踩过的 5 个认知坑', content: '一年前我还在为 VLOOKUP 焦虑。今天聊的不是函数，是差点让我放弃的认知坑。\n\n1 把"会工具"当"会分析"。2 一上来就建模。3 不敢问业务。4 报告写给自己看。5 只输入不输出。\n\n这个博客就是逼自己输出的产物——写出来，才算真的会。这条路不卷速度，卷持续。', images: [], links: [], tags: ['转行', '成长', '随笔'], emoji: '🌱', created_at: '2026-06-28T09:00:00Z' }
];

/* ===== 阅读页 ===== */
function renderRead(p, preview = false) {
  const tags = (p.tags || []).length ? `<div class="article-tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : '';
  const imgs = p.images || [];
  const gallery = imgs.length ? `<div class="article-gallery">${imgs.map(s => `<div class="gal-item" data-img="${esc(s)}"><img src="${s}" alt=""></div>`).join('')}</div>` : '';
  const links = (p.links || []).length ? `<div class="article-links"><h4><i class="fas fa-link"></i> 参考链接</h4>${p.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text || l.url)}</a>`).join('')}</div>` : '';
  let nav = '';
  if (!preview) {
    const idx = learningList.findIndex(a => String(a.id) === String(p.id));
    const newer = idx > 0 ? learningList[idx - 1] : null; const older = idx >= 0 && idx < learningList.length - 1 ? learningList[idx + 1] : null; const card = (a, dir, cls) => a ? `<div class="an ${cls}" data-id="${esc(a.id)}"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>${esc(a.title || '无标题')}</b></span></div>` : `<div class="an disabled"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>没有了</b></span></div>`;
    nav = `<div class="article-nav">${card(older, 'left', '')}${card(newer, 'right', 'next')}</div>`;
  }
  const attachments = p.attachments || [];
  const attHtml = attachments.length ? `<div class="article-attachments"><h4><i class="fas fa-paperclip"></i> 附件</h4>${attachments.map(f => {
    const icon = fileIcon(f.type, f.name || '');
    const size = fmtSize(f.size);
    return `<a class="att-card" href="${esc(f.url || '#')}" target="_blank" rel="noopener"><i class="fas ${icon}"></i><span><b>${esc(f.name || '未命名')}</b><small>${size}${f.type ? ' · ' + esc(f.type) : ''}</small></span><i class="fas fa-download"></i></a>`;
  }).join('')}</div>` : '';
  const localBar = p._local ? `<div class="preview-bar"><i class="fas fa-hard-drive"></i> 这篇还在本机，联网后会自动同步。<button class="btn btn-ghost" id="syncNow" style="padding:7px 14px"><i class="fas fa-rotate"></i> 立即同步</button></div>` : ''; const bar = preview ? `<div class="preview-bar"><i class="fas fa-eye"></i> 这是预览，尚未发布。<span class="back-link" id="backEdit" style="margin:0"><i class="fas fa-pen"></i> 返回编辑</span></div>` : `<div class="read-bar"><span class="back-link" id="backList"><i class="fas fa-arrow-left"></i> 返回学习成长</span><span class="rb-spacer"></span><button class="btn btn-ghost rb-btn" id="editCur"><i class="fas fa-pen"></i> 编辑</button><button class="btn btn-ghost rb-btn rb-del" id="delCur"><i class="fas fa-trash"></i> 删除</button></div>`;
  document.getElementById('readInner').innerHTML = `${bar}${localBar}<article class="article"><h1 class="article-title">${esc(p.title || '无标题')}</h1><div class="article-meta"><span>${fmtDate(p.created_at || new Date().toISOString())}</span>${tags}</div><div class="article-body">${(window.__isHTML && window.__isHTML(p.content)) ? p.content : toRTEHTML(p.content || '')}</div>${gallery}${refs}${attHtml}${nav}</article>`; document.getElementById('readInner').querySelectorAll('.gal-item').forEach(g => g.onclick = () => openLB(g.dataset.img));
  const bl = document.getElementById('backList'); if (bl) bl.onclick = () => go('learning');
  const be = document.getElementById('backEdit'); if (be) be.onclick = () => go('learning'); const sn = document.getElementById('syncNow'); if (sn) sn.onclick = () => resyncOne(p.id);
  const ec = document.getElementById('editCur'); if (ec) ec.onclick = () => editLearning(p.id);
  const dc = document.getElementById('delCur'); if (dc) dc.onclick = () => deleteLearning(p.id);
  document.querySelectorAll('.an[data-id]').forEach(el => el.onclick = () => renderRead(learningList.find(a => String(a.id) === el.dataset.id)));
}

/* ===== 卡片 ===== */
function cardHTML(p, i) {
  const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
  const tags = (p.tags || []).slice(0, 4).map(t => `<span>${esc(t)}</span>`).join(''); const ex = (p.content || '').replace(/<[^>]+>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\n+/g, ' ').trim().slice(0, 120);
  const pinned = isPinned(p) ? `<span class="pin-flag">📌 置顶</span>` : ''; const localFlag = p._local ? `<span class="draft-flag">📴 本机</span>` : '';
  const hasFiles = (p.attachments || []).length ? `<span class="file-flag"><i class="fas fa-paperclip"></i> ${p.attachments.length}</span>` : '';
  const mgmt = `<div class="pc-mgmt"><button class="pc-m" data-edit="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-del="${esc(p.id)}" data-local="${p._local ? 1 : 0}" title="删除"><i class="fas fa-trash"></i></button>${p._local ? `<button class="pc-m sync-btn" data-sync="${esc(p.id)}" title="同步云端"><i class="fas fa-rotate"></i></button>` : ''}</div>`;
  return `<article class="postcard postcard--row" data-id="${esc(p.id)}"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '📝'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>${pinned}${localFlag}${hasFiles}</div><h3 class="pc-title">${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p><div class="pc-tags">${tags}</div></div>${mgmt}</article>`;
}

/* ===== 学习成长 ===== */
let lrImages = [], lrLinks = [], lrFiles = [];
let editingId = null, editingLocal = false;
function setEditorMode(on) { const pub = document.getElementById('lrPub'); pub.innerHTML = on ? '<i class="fas fa-floppy-disk"></i> 保存修改' : '<i class="fas fa-paper-plane"></i> 发布'; let cb = document.getElementById('lrCancel'); if (on && !cb) { pub.insertAdjacentHTML('afterend', '<button class="btn btn-ghost" id="lrCancel" style="margin-left:8px"><i class="fas fa-xmark"></i> 取消编辑</button>'); document.getElementById('lrCancel').onclick = clearEditor; } else if (!on && cb) cb.remove(); }
function clearEditor() { editingId = null; editingLocal = false; document.getElementById('lrTitle').value = ''; if (window.__rte) window.__rte.clear(); else document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; lrFiles = []; renderThumbs(); renderLinkList(); renderFileList(); setEditorMode(false); }
function editLearning(id) { const p = learningList.find(a => String(a.id) === String(id)); if (!p) return; editingId = String(id); editingLocal = !!p._local; document.getElementById('lrTitle').value = p.title || ''; if (window.__rte) window.__rte.ed.innerHTML = toRTEHTML(p.content || ''); else document.getElementById('lrContent').value = p.content || ''; document.getElementById('lrTags').value = (p.tags || []).join(', '); lrImages = (p.images || []).slice(); renderThumbs(); lrLinks = (p.links || []).map(l => ({ text: l.text, url: l.url })); renderLinkList(); lrFiles = (p.attachments || []).slice(); renderFileList(); setEditorMode(true); showView('learning'); setNav('learning'); setTimeout(() => document.getElementById('lrTitle').scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); showToast('已进入编辑模式 · 改完点「保存修改」'); }
function renderThumbs() { document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => { if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb uploading"><div class="up-spin"><i class="fas fa-spinner fa-spin"></i></div><span class="up-hint">上传中</span></div>`; return `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmimg="${i}">&times;</button></div>`; }).join(''); }
document.getElementById('lrFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; await processImageUpload(f, lrImages, renderThumbs); } e.target.value = ''; });
document.getElementById('lrThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmimg]'); if (b) { lrImages.splice(+b.dataset.rmimg, 1); renderThumbs(); } });
function renderLinkList() { document.getElementById('lrLinkList').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><span>${esc(l.text || l.url)}</span><a href="${esc(l.url)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i></a><button data-rmlink="${i}"><i class="fas fa-times"></i></button></div>`).join(''); }
document.getElementById('lrAddLink').addEventListener('click', () => { const t = document.getElementById('lrLinkText'), u = document.getElementById('lrLinkUrl'); if (!u.value.trim()) return; lrLinks.push({ text: t.value.trim() || u.value.trim(), url: u.value.trim() }); t.value = ''; u.value = ''; renderLinkList(); });
document.getElementById('lrLinkList').addEventListener('click', e => { const b = e.target.closest('[data-rmlink]'); if (b) { lrLinks.splice(+b.dataset.rmlink, 1); renderLinkList(); } });

/* ===== 附件上传（Excel / PDF / Word 等） ===== */
const FILE_ICONS = {
  'pdf': 'fa-file-pdf', 'excel': 'fa-file-excel', 'word': 'fa-file-word',
  'powerpoint': 'fa-file-powerpoint', 'zip': 'fa-file-zipper',
  'text': 'fa-file-lines', 'csv': 'fa-file-csv', 'default': 'fa-file'
};
function fileIcon(type, name) {
  const t = String(type || '').toLowerCase();
  if (t.includes('pdf')) return FILE_ICONS.pdf;
  if (t.includes('excel') || t.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return FILE_ICONS.excel;
  if (t.includes('word') || t.includes('document') || name.endsWith('.docx') || name.endsWith('.doc')) return FILE_ICONS.word;
  if (t.includes('powerpoint') || t.includes('presentation') || name.endsWith('.pptx') || name.endsWith('.ppt')) return FILE_ICONS.powerpoint;
  if (t.includes('zip') || t.includes('compressed')) return FILE_ICONS.zip;
  if (t.includes('text') || name.endsWith('.txt') || name.endsWith('.md')) return FILE_ICONS.text;
  return FILE_ICONS.default;
}
function fmtSize(b) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB'; return (b/(1024*1024)).toFixed(1) + ' MB'; }
function renderFileList() {
  const el = document.getElementById('lrFiles');
  if (!el) return;
  el.innerHTML = lrFiles.map((f, i) => {
    const name = esc(f.name || '未命名文件');
    const icon = fileIcon(f.type, f.name || '');
    const size = fmtSize(f.size);
    const url = f.url || f.dataUrl || '';
    return `<div class="lr-fileitem"><i class="fas ${icon}"></i><span class="lf-name">${name}${size ? '<small>'+size+'</small>' : ''}</span>${url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener" class="lf-view"><i class="fas fa-eye"></i></a>' : ''}<button data-rmfile="${i}"><i class="fas fa-times"></i></button></div>`;
  }).join('');
}

async function uploadToSupabaseStorage(file, bucket) {
  if (!sb) throw new Error('Supabase 未连接');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `learning/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { data, error } = await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);
  return { url: publicUrl, path };
}

document.getElementById('lrDoc').addEventListener('change', async e => {
  const files = [...e.target.files];
  for (const f of files) {
    const placeholder = { name: f.name, size: f.size, type: f.type, _uploading: true };
    lrFiles.push(placeholder);
    const idx = lrFiles.length - 1;
    renderFileList();
    try {
      if (sb) {
        const { url } = await uploadToSupabaseStorage(f, 'learning-files');
        lrFiles[idx] = { name: f.name, size: f.size, type: f.type, url };
      } else {
        if (f.size > 2 * 1024 * 1024) { showToast('文件太大，请联网后再传（>2MB）'); lrFiles.splice(idx, 1); renderFileList(); continue; }
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        lrFiles[idx] = { name: f.name, size: f.size, type: f.type, dataUrl };
      }
    } catch (err) {
      console.error('上传失败', err);
      showToast('「' + f.name + '」上传失败，已保留在本机');
      lrFiles[idx] = { name: f.name, size: f.size, type: f.type, _failed: true };
    }
    renderFileList();
  }
  e.target.value = '';
});
document.getElementById('lrFiles').addEventListener('click', e => {
  const b = e.target.closest('[data-rmfile]');
  if (b) { lrFiles.splice(+b.dataset.rmfile, 1); renderFileList(); }
});

function gatherPost() { return { title: document.getElementById('lrTitle').value.trim(), content: document.getElementById('lrContent').value.trim(), images: lrImages.slice(), links: lrLinks.slice(), tags: document.getElementById('lrTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean), attachments: lrFiles.map(f => ({ name: f.name, size: f.size, type: f.type, url: f.url || f.dataUrl || '' })).filter(f => f.url) }; }
document.getElementById('lrPreview').addEventListener('click', () => { const p = gatherPost(); if (!p.title && !p.content) { showToast('先写点什么再预览'); return; } showView('read'); setNav('read'); renderRead({ ...p, id: 'preview', created_at: new Date().toISOString() }, true); });
document.getElementById('lrPub').addEventListener('click', publishLearning);

async function publishLearning() {
  if (typeof editingId !== 'undefined' && editingId) {
    const p = gatherPost();
    if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
    const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中…';
    const sid = String(editingId); const isSeed = sid.indexOf('seed-') === 0;
    let ok = false;
    const ppLR = getPostedLR(); const piLR = ppLR.findIndex(a => String(a.id) === sid);
    if (piLR >= 0) { ppLR[piLR] = Object.assign({}, ppLR[piLR], { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, attachments: p.attachments }); setPostedLR(ppLR); ok = true; }
    const d = getLR(); const idx = d.findIndex(a => String(a.id) === sid);
    if (idx >= 0) { d[idx] = Object.assign({}, d[idx], { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, attachments: p.attachments }); setLR(d); ok = true; }
    if (isSeed) { const ov = getEdit(); ov[sid] = { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, attachments: p.attachments }; setEdit(ov); ok = true; }
    if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').update({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, attachments: p.attachments, emoji: '📝' }).eq('id', sid), 20000); ok = !r.error; } catch (e) { } } }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> 保存修改';
    if (ok) { invalidateLearning(); await loadLearning(); clearEditor(); showToast('已保存 ✓'); } else showToast('保存失败，请检查网络'); return;
  }
  const p = gatherPost(); if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
  const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发布中…';
  let ok = false;
  if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('learning').insert({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, attachments: p.attachments, emoji: '📝' }), 20000); ok = !res.error; } catch (e) { } } }
  if (ok) {
    const pool = getPostedLR(); pool.unshift({ id: uid('LR'), ...p, emoji: '📝', created_at: new Date().toISOString(), attachments: p.attachments }); setPostedLR(pool);
    invalidateLearning(); await loadLearning(); clearEditor(); showToast('发布成功 ✓');
  } else {
    const d = getLR(); d.unshift({ id: uid('LR'), ...p, emoji: '📝', created_at: new Date().toISOString(), _local: true, attachments: p.attachments }); setLR(d);
    invalidateLearning(); await loadLearning(); clearEditor(); showToast('已保存到本机（断网状态）');
  }
  btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布';
}

async function deleteLearning(id) {
  const p = learningList.find(a => String(a.id) === String(id)); if (!p) return;
  if (!confirm('确定要删除「' + (p.title || '无标题') + '」吗？')) return;
  let ok = false;
  if (sb) { try { const r = await withTimeout(sb.from('learning').delete().eq('id', id), 15000); ok = !r.error; } catch (e) { } }
  const d = getLR().filter(a => String(a.id) !== String(id)); setLR(d);
  const pool = getPostedLR().filter(a => String(a.id) !== String(id)); setPostedLR(pool);
  const ov = getEdit(); delete ov[id]; setEdit(ov);
  invalidateLearning(); await loadLearning(); showToast('已删除 ✓');
}

async function resyncOne(id) {
  const d = getLR(); const x = d.find(a => a.id === id); if (!x || !sb) return;
  let ok = false;
  try {
    const migrated = await migrateImagesToStorage(x.images);
    const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: migrated, links: x.links, tags: x.tags, attachments: x.attachments || [], emoji: x.emoji || '📝' }), 15000);
    ok = !r.error;
  } catch (e) { }
  if (ok) { setLR(d.filter(a => a.id !== id)); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); showToast('已同步到云端 ✓'); }
  else showToast('同步失败，稍后再试（内容仍安全存在本机）');
}

/* ===== 列表渲染 ===== */
function renderLearningList() {
  const g = document.getElementById('learningGrid');
  let list = learningList;
  if (_lrQuery) {
    list = list.filter(p => {
      const hay = (p.title + ' ' + (p.content || '').replace(/<[^>]+>/g, '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return hay.includes(_lrQuery);
    });
  }
  if (!list.length) { g.innerHTML = '<div class="no-result">还没有学习记录，写第一篇吧 ✍️</div>'; return; }
  g.innerHTML = list.map(cardHTML).join('');
}
let _lrQuery = '';
document.getElementById('lrSearch').addEventListener('input', e => {
  _lrQuery = e.target.value.trim().toLowerCase();
  renderLearningList();
});

/* ===== 生活随笔 ===== */
let lifeImages = [];
function renderLifeList() {
  const g = document.getElementById('lifeGrid'); if (!g) return;
  if (!lifeList.length) { g.innerHTML = '<div class="no-result">还没有随笔，记录第一条吧 ✍️</div>'; return; }
  g.innerHTML = lifeList.map((p, i) => {
    const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
    const ex = (p.content || '').replace(/<[^>]+>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\n+/g, ' ').trim().slice(0, 120);
    const localFlag = p._local ? `<span class="draft-flag">📴 本机</span>` : '';
    const mgmt = `<div class="pc-mgmt"><button class="pc-m" data-edit-life="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-del-life="${esc(p.id)}" data-local="${p._local ? 1 : 0}" title="删除"><i class="fas fa-trash"></i></button>${p._local ? `<button class="pc-m sync-btn" data-sync-life="${esc(p.id)}" title="同步云端"><i class="fas fa-rotate"></i></button>` : ''}</div>`;
    return `<article class="postcard postcard--row" data-id="${esc(p.id)}"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '🌱'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>${localFlag}</div><h3 class="pc-title">${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p></div>${mgmt}</article>`;
  }).join('');
}
function renderLifeThumbs() { document.getElementById('lifeThumbs').innerHTML = lifeImages.map((s, i) => { if (s && typeof s === 'object' && s._uploading) return `<div class="lr-thumb uploading"><div class="up-spin"><i class="fas fa-spinner fa-spin"></i></div><span class="up-hint">上传中</span></div>`; return `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmlife="${i}">&times;</button></div>`; }).join(''); }
document.getElementById('lifeFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; await processImageUpload(f, lifeImages, renderLifeThumbs); } e.target.value = ''; });
document.getElementById('lifeThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmlife]'); if (b) { lifeImages.splice(+b.dataset.rmlife, 1); renderLifeThumbs(); } });
function gatherLife() { return { title: document.getElementById('lifeTitle').value.trim(), content: document.getElementById('lifeContent').value.trim(), images: lifeImages.slice(), tags: document.getElementById('lifeTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean) }; }
document.getElementById('lifePub').addEventListener('click', async () => { const p = gatherLife(); if (!p.title) { document.getElementById('lifeTitle').focus(); showToast('请填写标题'); return; } const btn = document.getElementById('lifePub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发布中…'; let ok = false; if (sb) { for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('life').insert({ title: p.title, content: p.content, images: p.images, tags: p.tags, emoji: '🌱' }), 20000); ok = !res.error; } catch (e) { } } } if (ok) { const pool = getPostedLife(); pool.unshift({ id: uid('LF'), ...p, emoji: '🌱', created_at: new Date().toISOString() }); setPostedLife(pool); invalidateLife(); await loadLife(); document.getElementById('lifeTitle').value = ''; document.getElementById('lifeContent').value = ''; document.getElementById('lifeTags').value = ''; lifeImages = []; renderLifeThumbs(); showToast('发布成功 ✓'); } else { const d = getLife(); d.unshift({ id: uid('LF'), ...p, emoji: '🌱', created_at: new Date().toISOString(), _local: true }); setLife(d); invalidateLife(); await loadLife(); document.getElementById('lifeTitle').value = ''; document.getElementById('lifeContent').value = ''; document.getElementById('lifeTags').value = ''; lifeImages = []; renderLifeThumbs(); showToast('已保存到本机（断网状态）'); } btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布'; });

/* ===== 首页最新 ===== */
function renderHomeLatest() {
  const lr = learningList.slice(0, 4); const lf = lifeList.slice(0, 4);
  const lrWrap = document.getElementById('homeLR'); const lfWrap = document.getElementById('homeLife');
  if (lrWrap) lrWrap.innerHTML = lr.map(cardHTML).join('') || '<div class="no-result">还没有学习记录</div>';
  if (lfWrap) lfWrap.innerHTML = lf.map((p, i) => {
    const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
    const ex = (p.content || '').replace(/<[^>]+>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\n+/g, ' ').trim().slice(0, 120);
    return `<article class="postcard postcard--row" data-id="${esc(p.id)}"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji || '🌱'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span></div><h3 class="pc-title">${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p></div></article>`;
  }).join('') || '<div class="no-result">还没有随笔</div>';
}

/* ===== 灯箱 ===== */
const lb = document.getElementById('lightbox');
function openLB(src) { lb.querySelector('img').src = src; lb.classList.add('show'); lockScroll(true); }
lb.onclick = () => { lb.classList.remove('show'); lockScroll(false); };

/* ===== 路由 ===== */
const views = ['home','about','projects','learning','life','read'];
function showView(id) { views.forEach(v => document.getElementById('view-' + v).classList.toggle('show', v === id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function setNav(id) { document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === id)); }
function go(id, push = true) { showView(id); setNav(id); if (push) history.pushState({ view: id }, '', '#' + id); }
window.addEventListener('popstate', e => { const s = e.state && e.state.view; if (s) { showView(s); setNav(s); } else { showView('home'); setNav('home'); } });
document.querySelectorAll('.sidebar nav a').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.nav); });
document.querySelectorAll('.js-nav').forEach(el => el.onclick = e => { e.preventDefault(); go(el.dataset.nav); });
const initHash = location.hash.replace('#', '') || 'home'; if (views.includes(initHash)) { showView(initHash); setNav(initHash); } else { showView('home'); setNav('home'); }

/* ===== 事件委托 ===== */
document.getElementById('learningGrid').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit]'); if (edit) { e.stopPropagation(); editLearning(edit.dataset.edit); return; }
  const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); deleteLearning(del.dataset.del); return; }
  const sync = e.target.closest('[data-sync]'); if (sync) { e.stopPropagation(); resyncOne(sync.dataset.sync); return; }
  const card = e.target.closest('.postcard'); if (card) { const id = card.dataset.id; const p = learningList.find(a => String(a.id) === id); if (p) { showView('read'); setNav('read'); renderRead(p); } }
});
document.getElementById('lifeGrid').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit-life]'); if (edit) { e.stopPropagation(); const p = lifeList.find(a => String(a.id) === edit.dataset.editLife); if (!p) return; document.getElementById('lifeTitle').value = p.title || ''; document.getElementById('lifeContent').value = p.content || ''; document.getElementById('lifeTags').value = (p.tags || []).join(', '); lifeImages = (p.images || []).slice(); renderLifeThumbs(); showView('life'); setNav('life'); setTimeout(() => document.getElementById('lifeTitle').scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); showToast('已进入编辑模式 · 改完直接点发布'); return; }
  const del = e.target.closest('[data-del-life]'); if (del) { e.stopPropagation(); const p = lifeList.find(a => String(a.id) === del.dataset.delLife); if (!p) return; if (!confirm('确定要删除「' + (p.title || '无标题') + '」吗？')) return; let ok = false; if (sb) { try { const r = await withTimeout(sb.from('life').delete().eq('id', del.dataset.delLife), 15000); ok = !r.error; } catch (e) { } } const d = getLife().filter(a => String(a.id) !== String(del.dataset.delLife)); setLife(d); const pool = getPostedLife().filter(a => String(a.id) !== String(del.dataset.delLife)); setPostedLife(pool); invalidateLife(); await loadLife(); showToast('已删除 ✓'); return; }
  const sync = e.target.closest('[data-sync-life]'); if (sync) { e.stopPropagation(); const x = getLife().find(a => a.id === sync.dataset.syncLife); if (!x || !sb) return; let ok = false; try { const migrated = await migrateImagesToStorage(x.images); const r = await withTimeout(sb.from('life').insert({ title: x.title, content: x.content, images: migrated, tags: x.tags, emoji: x.emoji || '🌱' }), 15000); ok = !r.error; } catch (e) { } if (ok) { const d = getLife().filter(a => a.id !== sync.dataset.syncLife); setLife(d); invalidateLife(); await loadLife(); showToast('已同步到云端 ✓'); } else showToast('同步失败，稍后再试'); return; }
  const card = e.target.closest('.postcard'); if (card) { const id = card.dataset.id; const p = lifeList.find(a => String(a.id) === id); if (p) { showView('read'); setNav('read'); renderRead(p); } }
});
document.getElementById('homeLR').addEventListener('click', e => { const card = e.target.closest('.postcard'); if (!card) return; const id = card.dataset.id; const p = learningList.find(a => String(a.id) === id); if (p) { showView('read'); setNav('read'); renderRead(p); } });
document.getElementById('homeLife').addEventListener('click', e => { const card = e.target.closest('.postcard'); if (!card) return; const id = card.dataset.id; const p = lifeList.find(a => String(a.id) === id); if (p) { showView('read'); setNav('read'); renderRead(p); } });

/* ===== 暗色模式 ===== */
const themeBtn = document.getElementById('themeBtn');
const savedTheme = localStorage.getItem('chi_theme');
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
themeBtn.onclick = () => { const isDark = document.documentElement.getAttribute('data-theme') === 'dark'; document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark'); localStorage.setItem('chi_theme', isDark ? 'light' : 'dark'); };

/* ===== 初始化 ===== */
(async () => { await loadLearning(); await loadLife(); })();
