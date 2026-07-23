/* ===== 云端 ===== */
const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const linkify = h => esc(h).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
function lockScroll(on) { document.body.style.overflow = on ? 'hidden' : ''; }
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isPinned = a => (a.tags || []).includes('置顶');
function sortPosts(arr) { return arr.slice().sort((a, b) => { const pa = isPinned(a) ? 1 : 0, pb = isPinned(b) ? 1 : 0; if (pa !== pb) return pb - pa; return new Date(b.created_at) - new Date(a.created_at); }); }
window.__isHTML = function (s) { return /<[a-z][\s\S]*>/i.test(s || ''); };
function toRTEHTML(raw) { raw = raw == null ? '' : String(raw); if (window.__isHTML(raw)) return raw; return raw.split('\n').map(l => { const e = esc(l); return '<p>' + (e || '<br>') + '</p>'; }).join(''); }

/* ===== 路由（go 根治"同网址不刷新"） ===== */
const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('#nav a')];
function revealIn(v) { const els = v.querySelectorAll('.reveal'); els.forEach(e => e.classList.remove('in')); requestAnimationFrame(() => requestAnimationFrame(() => { let i = 0; els.forEach(e => { e.style.transitionDelay = (Math.min(i++, 7) * 0.05) + 's'; e.classList.add('in'); }); })); }
function showView(n) { views.forEach(v => v.classList.toggle('active', v.dataset.view === n)); const c = document.querySelector('.view.active'); if (c) revealIn(c); window.scrollTo(0, 0); }
function setNav(n) { navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === n)); }
function go(target) { const cur = location.hash.replace(/^#/, ''); if (cur === target) { route(); } else { location.hash = target; } }
async function route() {
    const h = (location.hash.replace(/^#/, '') || 'home'); const [view, param] = h.split('/');
    if (view === 'read') {
        const r = await loadLearning(); if (!r.ok) { go('learning'); return; }
        const art = learningList.find(a => String(a.id) === param);
        if (art) { renderRead(art, false); showView('read'); setNav('learning'); } else go('learning');
        return;
    }
    if (view === 'learning') { await loadLearning(); renderLearningList(); }
    if (view === 'life') { await loadPosts(); }
    if (view === 'home') { await loadLearning(); renderHomeLatest(); }
    const valid = ['home', 'about', 'projects', 'learning', 'life'].includes(view) ? view : 'home';
    showView(valid); setNav(valid);
}
/* 所有 # 开头内部链接统一走 go（含导航/导览，解决同 hash 不刷新） */
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

/* ===== 项目案例（演示+分析 双文档） ===== */
const CASES = [
    { color: 'linear-gradient(135deg,#e8730c,#ff9d4d)', icon: 'fa-layer-group', tag: 'USER VALUE', title: 'RFM 用户价值分析案例', desc: '基于 SQL 取数 + Python(Pandas) 构建 RFM 模型，对线上平台用户做三维度打分与分层，输出可复现的交互式分析报告。', tech: ['SQL', 'Python', 'Pandas', 'Jupyter'], docs: [{ label: '交互式报告', href: '线上平台用户RFM分析.html' }], dl: '线上平台用户RFM分析.ipynb' },
    { color: 'linear-gradient(135deg,#2f6fed,#5b8def)', icon: 'fa-boxes-stacked', tag: 'INVENTORY', title: '快消品进销存分析', desc: '以 Power BI 完成数据建模与清洗，搭建进销存看板 + 分析报告：监控库存、月销与临期风险，完成 ABC 动销与智能补货诊断。', tech: ['Power BI', 'DAX'], docs: [{ label: '演示案例', href: '快消品进销存演示案例.pdf' }, { label: '分析报告', href: '快消品进销存案例分析报告.pdf' }], dl: '快消品进销存演示案例.pbix' },
    { color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: 'fa-rotate', tag: 'RETENTION · LTV', title: '复购与留存分析', desc: '复购专题双报告：销售趋势、留存、新增/复购拆解，以及母婴店铺「黄金60天」转化归因，核心度量以 DAX 实现。', tech: ['Power BI', 'DAX', '归因分析'], docs: [{ label: '演示案例', href: '复购分析案例.pdf' }, { label: '分析报告', href: '复购案例分析.pdf' }], dl: '复购分析案例.pbix' }
];
function renderCases() { document.getElementById('caseGrid').innerHTML = CASES.map((c, i) => `<article class="case"><div class="case-cover" style="background:${c.color}" data-doc0="${esc((c.docs[0] || {}).href || '')}"><span class="big">${String(i + 1).padStart(2, '0')}</span><i class="ci fas ${c.icon}"></i><span class="ctag">${c.tag}</span></div><div class="case-body"><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p><div class="case-docs">${c.docs.map(d => `<a class="case-doc" href="${esc(d.href)}" target="_blank" rel="noopener"><i class="fas fa-file-lines"></i> ${esc(d.label)}</a>`).join('')}</div><div class="case-foot"><div class="case-tech">${c.tech.map(t => `<span>${esc(t)}</span>`).join('')}</div><a class="case-dl" href="${esc(c.dl)}" download><i class="fas fa-download"></i> 源文件</a></div></div></article>`).join(''); }
document.getElementById('caseGrid').addEventListener('click', e => { const cv = e.target.closest('.case-cover'); if (cv && !e.target.closest('.case-doc') && !e.target.closest('.case-dl') && cv.dataset.doc0) window.open(cv.dataset.doc0, '_blank'); });

/* ===== 证书 ===== */
const CERTS = [{ n: 'CDA 数据分析师', s: 'LEVEL-1', img: './certs/CDA-LEVEL1.jpg' }, { n: 'Office 计算机', s: '二级证书', img: './certs/office_level2.jpg' }, { n: '英语六级', s: 'CET-6', img: './certs/CET6.jpg' }, { n: '普通话', s: '二甲证书', img: './certs/putonghua.jpg' }];
function renderCerts() { document.getElementById('certGrid').innerHTML = CERTS.map(c => `<div class="cert" data-img="${esc(c.img)}"><div class="thumb"><img src="${esc(c.img)}" alt="${esc(c.n)}" loading="lazy" onerror="this.style.display='none'"><div class="zoom"><i class="fas fa-magnifying-glass-plus"></i>查看大图</div></div><div class="cn">${esc(c.n)}<small>${esc(c.s)}</small></div></div>`).join(''); }
document.getElementById('certGrid').addEventListener('click', e => { const el = e.target.closest('[data-img]'); if (el) openLB(el.dataset.img); });
function openLB(src) { document.getElementById('lbImg').src = src; document.getElementById('lightbox').classList.add('on'); lockScroll(true); }

/* ===== 学习成长：seed 兜底 ===== */
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
        try { const res = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 8000); if (!res.error && res.data) cloud = res.data; } catch (e) { }
        if (cloud !== null) { // 云端通：先补传本机草稿
            const drafts = getLR(); if (drafts.length) { const remain = []; for (const x of drafts) { let ok = false; try { const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: x.images, links: x.links, tags: x.tags, emoji: x.emoji || '📝' }), 20000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } setLR(remain); if (remain.length !== drafts.length) { try { const r2 = await withTimeout(sb.from('learning').select('*').order('created_at', { ascending: false }).limit(100), 8000); if (!r2.error && r2.data) cloud = r2.data; } catch (e) { } } }
            learningList = sortPosts([...cloud.map(p => ({ ...p, emoji: p.emoji || '📝' })), ...getLR().map(x => ({ ...x, _local: true }))]);
            learningList = applyLocalOverlay(learningList);
            return { ok: true };
        }
        // 云端不通：seed + 本机草稿
        learningList = sortPosts([...SEED_LEARNING, ...getLR().map(x => ({ ...x, _local: true }))]);
        learningList = applyLocalOverlay(learningList);
        return { ok: true };
    })();
}
function invalidateLearning() { _lp = null; }
function cardHTML(p,i){
  const imgs=p.images||[];const cover=imgs[0]?`background-image:url('${imgs[0]}')`:`background:${GRADS[i%GRADS.length]}`;
  const tags=(p.tags||[]).slice(0,4).map(t=>`<span>${esc(t)}</span>`).join('');
  const ex=(p.content||'').replace(/<[^>]+>/g,'').replace(/https?:\/\/\S+/g,'').replace(/\n+/g,' ').trim().slice(0,120);
  const pinned=isPinned(p)?`<span class="pin-flag">📌 置顶</span>`:'';const localFlag=p._local?`<span class="draft-flag">📴 本机</span>`:'';
  const mgmt=`<div class="pc-mgmt"><button class="pc-m" data-edit="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-del="${esc(p.id)}" data-local="${p._local?1:0}" title="删除"><i class="fas fa-trash"></i></button>${p._local?`<button class="pc-m sync-btn" data-sync="${esc(p.id)}" title="同步云端"><i class="fas fa-rotate"></i></button>`:''}</div>`;
  return `<article class="postcard postcard--row" data-id="${esc(p.id)}"><div class="pc-thumb" style="${cover}"><span class="pc-emoji">${p.emoji||'📝'}</span></div><div class="pc-main"><div class="pc-top"><span class="pc-date">${fmtDate(p.created_at||new Date().toISOString())}</span>${pinned}${localFlag}</div><h3 class="pc-title">${esc(p.title||'无标题')}</h3><p class="pc-ex">${esc(ex)}</p><div class="pc-tags">${tags}</div></div>${mgmt}</article>`;
}
function renderLearningList() { const g = document.getElementById('learningGrid'); if (!learningList.length) { g.innerHTML = '<div class="no-result">还没有学习记录，写第一篇吧 ✍️</div>'; return; } g.innerHTML = learningList.map(cardHTML).join(''); }
function renderHomeLatest() { const list = learningList.slice(0, 5); const h = document.getElementById('homeLatestH'), g = document.getElementById('homeLatest'); if (!list.length) { h.style.display = 'none'; g.innerHTML = ''; return; } h.style.display = 'flex'; g.innerHTML = list.map(cardHTML).join(''); }
async function resyncOne(id) { const d = getLR(); const x = d.find(a => a.id === id); if (!x) return; let ok = false; try { const r = await withTimeout(sb.from('learning').insert({ title: x.title, content: x.content, images: x.images, links: x.links, tags: x.tags, emoji: x.emoji || '📝' }), 20000); ok = !r.error; } catch (e) { } if (ok) { setLR(d.filter(a => a.id !== id)); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); showToast('已同步到云端 ✓'); } else showToast('同步失败，稍后再试（内容仍安全存在本机）'); }
function renderRead(p, preview) {
    const tags = (p.tags || []).map(t => `<span class="mtag">${esc(t)}</span>`).join('');
    const imgs = p.images || [];
    const gallery = imgs.length ? `<div class="article-gallery">${imgs.map(s => `<div class="gal-item" data-img="${s}"><img src="${s}" alt=""></div>`).join('')}</div>` : '';
    const links = p.links || [];
    const refs = links.length ? `<div class="article-refs"><h4><i class="fas fa-link"></i> 参考链接</h4>${links.map(l => `<a class="ref-card" href="${esc(l.url)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i><span><b>${esc(l.text || l.url)}</b><small>${esc(l.url)}</small></span><i class="fas fa-external-link-alt"></i></a>`).join('')}</div>` : '';
    let nav = '';
    if (!preview) {
        const idx = learningList.findIndex(a => String(a.id) === String(p.id));
        const newer = idx > 0 ? learningList[idx - 1] : null; const older = idx >= 0 && idx < learningList.length - 1 ? learningList[idx + 1] : null;
        const card = (a, dir, cls) => a ? `<div class="an ${cls}" data-id="${esc(a.id)}"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>${esc(a.title || '无标题')}</b></span></div>` : `<div class="an disabled"><i class="fas fa-arrow-${dir}"></i><span><small>${dir === 'left' ? '上一篇' : '下一篇'}</small><b>没有了</b></span></div>`;
        nav = `<div class="article-nav">${card(older, 'left', '')}${card(newer, 'right', 'next')}</div>`;
    }
    const localBar = p._local ? `<div class="preview-bar"><i class="fas fa-hard-drive"></i> 这篇还在本机，联网后会自动同步。<button class="btn btn-ghost" id="syncNow" style="padding:7px 14px"><i class="fas fa-rotate"></i> 立即同步</button></div>` : '';
        const bar = preview ? `<div class="preview-bar"><i class="fas fa-eye"></i> 这是预览，尚未发布。<span class="back-link" id="backEdit" style="margin:0"><i class="fas fa-pen"></i> 返回编辑</span></div>` : `<div class="read-bar"><span class="back-link" id="backList"><i class="fas fa-arrow-left"></i> 返回学习成长</span><span class="rb-spacer"></span><button class="btn btn-ghost rb-btn" id="editCur"><i class="fas fa-pen"></i> 编辑</button><button class="btn btn-ghost rb-btn rb-del" id="delCur"><i class="fas fa-trash"></i> 删除</button></div>`;
    document.getElementById('readInner').innerHTML = `${bar}${localBar}<article class="article"><h1 class="article-title">${esc(p.title || '无标题')}</h1><div class="article-meta"><span>${fmtDate(p.created_at || new Date().toISOString())}</span>${tags}</div><div class="article-body">${(window.__isHTML&&window.__isHTML(p.content))?p.content:linkify(p.content||'')}</div>${gallery}${refs}${nav}</article>`;
    document.getElementById('readInner').querySelectorAll('.gal-item').forEach(g => g.onclick = () => openLB(g.dataset.img));
    const bl = document.getElementById('backList'); if (bl) bl.onclick = () => go('learning');
    const be = document.getElementById('backEdit'); if (be) be.onclick = () => go('learning');
    const sn = document.getElementById('syncNow'); if (sn) sn.onclick = () => resyncOne(p.id);
    const ec = document.getElementById('editCur'); if (ec) ec.onclick = () => editLearning(p.id);
    const dc = document.getElementById('delCur'); if (dc) dc.onclick = () => deleteLearning(p.id, !!p._local);
    document.getElementById('readInner').querySelectorAll('.an[data-id]').forEach(a => a.onclick = () => go('read/' + a.dataset.id));
}

/* ===== 学习成长：编辑器 ===== */
let lrImages = [], lrLinks = [];
let editingId = null, editingLocal = false;
function setEditorMode(on){const pub=document.getElementById('lrPub');pub.innerHTML=on?'<i class="fas fa-floppy-disk"></i> 保存修改':'<i class="fas fa-paper-plane"></i> 发布';let cb=document.getElementById('lrCancel');if(on&&!cb){pub.insertAdjacentHTML('afterend','<button class="btn btn-ghost" id="lrCancel" style="margin-left:8px"><i class="fas fa-xmark"></i> 取消编辑</button>');document.getElementById('lrCancel').onclick=clearEditor;}else if(!on&&cb)cb.remove();}
function clearEditor(){editingId=null;editingLocal=false;document.getElementById('lrTitle').value='';document.getElementById('lrContent').value='';document.getElementById('lrTags').value='';lrImages=[];lrLinks=[];renderThumbs();renderLinkList();setEditorMode(false);}
function editLearning(id){const p=learningList.find(a=>String(a.id)===String(id));if(!p)return;editingId=String(id);editingLocal=!!p._local;document.getElementById('lrTitle').value=p.title||'';document.getElementById('lrContent').value=p.content||'';document.getElementById('lrTags').value=(p.tags||[]).join(', ');lrImages=(p.images||[]).slice();renderThumbs();lrLinks=(p.links||[]).map(l=>({text:l.text,url:l.url}));renderLinkList();setEditorMode(true);showView('learning');setNav('learning');setTimeout(()=>document.getElementById('lrTitle').scrollIntoView({behavior:'smooth',block:'center'}),80);showToast('已进入编辑模式 · 改完点「保存修改」');}
/* ===== 本机小账本：示例文的"隐藏/覆盖"（不影响云端真数据） ===== */
const HIDE_KEY = 'chi_lr_hide', EDIT_KEY = 'chi_lr_edit';
const getHide = () => { try { const r = JSON.parse(localStorage.getItem(HIDE_KEY)); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
const setHide = a => localStorage.setItem(HIDE_KEY, JSON.stringify(a));
const getEdit = () => { try { const r = JSON.parse(localStorage.getItem(EDIT_KEY)); return r && typeof r === 'object' ? r : {}; } catch (e) { return {}; } };
const setEdit = o => localStorage.setItem(EDIT_KEY, JSON.stringify(o));
function applyLocalOverlay(arr) { const hide = getHide(); const ov = getEdit(); return arr.filter(p => !hide.includes(String(p.id))).map(p => { const o = ov[String(p.id)]; if (!o) return p; return Object.assign({}, p, { title: o.title, content: o.content, images: o.images, links: o.links, tags: o.tags }); }); }
async function deleteLearning(id, isLocal) {
    if (!confirm('确定删除这篇文章？此操作不可撤销。')) return;
    const sid = String(id); const isSeed = sid.indexOf('seed-') === 0;
    if (isLocal) {
        setLR(getLR().filter(a => String(a.id) !== sid));
    } else if (isSeed) {
        const h = getHide(); if (!h.includes(sid)) h.push(sid); setHide(h);
    } else {
        let ok = false;
        for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').delete().eq('id', sid), 15000); ok = !r.error; } catch (e) { } }
        if (!ok) { showToast('删除失败 · 若重试仍失败，是数据库没开「删除权限」，见 SQL'); return; }
    }
    invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest();
    if ((location.hash.replace(/^#/, '')).startsWith('read/')) go('learning');
    showToast('已删除 ✓');
}
function renderThumbs() { document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmimg="${i}">&times;</button></div>`).join(''); }
function renderLinkList() { document.getElementById('lrLinkList').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><i class="lk fas fa-link"></i><span class="lt">${esc(l.text || l.url)}<small>${esc(l.url)}</small></span><button data-rmlink="${i}"><i class="fas fa-times"></i></button></div>`).join(''); }
document.getElementById('lrFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; lrImages.push(await compress(f)); } renderThumbs(); e.target.value = ''; });
document.getElementById('lrThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmimg]'); if (b) { lrImages.splice(+b.dataset.rmimg, 1); renderThumbs(); } });
document.getElementById('lrAddLink').addEventListener('click', () => { const t = document.getElementById('lrLinkText'), u = document.getElementById('lrLinkUrl'); const url = u.value.trim(); if (!url) { u.focus(); return; } lrLinks.push({ text: t.value.trim() || url, url }); t.value = ''; u.value = ''; renderLinkList(); });
document.getElementById('lrLinkList').addEventListener('click', e => { const b = e.target.closest('[data-rmlink]'); if (b) { lrLinks.splice(+b.dataset.rmlink, 1); renderLinkList(); } });
function gatherPost() { return { title: document.getElementById('lrTitle').value.trim(), content: document.getElementById('lrContent').value.trim(), images: lrImages.slice(), links: lrLinks.slice(), tags: document.getElementById('lrTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean) }; }
document.getElementById('lrPreview').addEventListener('click', () => { const p = gatherPost(); if (!p.title && !p.content) { showToast('先写点标题或正文再预览'); return; } renderRead({ ...p, created_at: new Date().toISOString(), emoji: '👀' }, true); showView('read'); setNav('learning'); });
document.getElementById('lrPub').addEventListener('click', publishLearning);
async function publishLearning() {  // ===== 编辑拦截：编辑模式走"更新"，绝不走下面的 insert =====
  if (typeof editingId !== 'undefined' && editingId) {
    const p = gatherPost();
    if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
    const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中…';
    const sid = String(editingId); const isSeed = sid.indexOf('seed-') === 0;
    let ok = false;
    if (typeof editingLocal !== 'undefined' && editingLocal) {
      const d = getLR(); const idx = d.findIndex(a => String(a.id) === sid);
      if (idx >= 0) { d[idx] = Object.assign({}, d[idx], { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags }); setLR(d); ok = true; }
    } else if (isSeed) {
      const ov = getEdit(); ov[sid] = { title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags }; setEdit(ov); ok = true;
    } else {
      for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('learning').update({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, emoji: '📝' }).eq('id', sid), 25000); ok = !r.error; } catch (e) { } }
    }
    btn.disabled = false;
    if (ok) { if (typeof clearEditor === 'function') clearEditor(); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); showToast('已保存修改 ✓'); return; }
    btn.innerHTML = '<i class="fas fa-floppy-disk"></i> 保存修改'; showToast('保存失败 · 原内容未丢失 · 若重试仍失败见 SQL'); return;
  }
  // ===== 拦截结束：下面是你原来的新增逻辑，保持不动 =====
    const p = gatherPost(); if (!p.title) { document.getElementById('lrTitle').focus(); showToast('请填写标题'); return; }
    const btn = document.getElementById('lrPub'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 发布中…';
    let ok = false;
    for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('learning').insert({ title: p.title, content: p.content, images: p.images, links: p.links, tags: p.tags, emoji: '📝' }), 25000); ok = !res.error; } catch (e) { } }
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> 发布';
    if (ok) { document.getElementById('lrTitle').value = ''; document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; renderThumbs(); renderLinkList(); invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest(); showToast('已发布 ✓ 同步到云端'); return; }
    // 失败：存本机，绝不丢
    const d = getLR(); d.unshift({ id: uid('LR'), ...p, emoji: '📝', created_at: new Date().toISOString(), _local: true }); setLR(d);
    document.getElementById('lrTitle').value = ''; document.getElementById('lrContent').value = ''; document.getElementById('lrTags').value = ''; lrImages = []; lrLinks = []; renderThumbs(); renderLinkList();
    invalidateLearning(); await loadLearning(); renderLearningList(); renderHomeLatest();
    showToast('已保存到本机 ✓ 联网后自动同步，内容不会丢', 6000);
}

/* ===== 生活随笔：实时同步 + 本机兜底 + 自动补传 + 编辑/删除/富文本 ===== */
const postList = document.getElementById('postList'), postInput = document.getElementById('postInput'), postTags = document.getElementById('postTags'), postPub = document.getElementById('postPub');
const PUB_HTML = postPub.innerHTML, SAVE_HTML = '<i class="fas fa-floppy-disk"></i> 保存修改', seenIds = new Set(), LKEY = 'chi_posts_local_v1'; let cloudOK = true, lifeImages = [], lifeList = [];
let lifeEditId = null, lifeEditLocal = false;
const SEED_LIFE = [{ id: 'sl1', content: '今天把进销存看板的"该补货吗"挪到了第一屏。看板的第一屏只该回答一个问题。', tags: ['复盘'], images: [], created_at: '2026-07-20T21:30:00Z' }, { id: 'sl2', content: '周末给草缸换了水，顺便把网球拍线也换了。生活和分析一样，定期维护才不会崩。🎾', tags: ['生活'], images: [], created_at: '2026-07-13T18:00:00Z' }];
function loadLocal() { try { const r = JSON.parse(localStorage.getItem(LKEY)); if (Array.isArray(r)) return r; } catch (e) { } return []; }
function saveLocal(p) { localStorage.setItem(LKEY, JSON.stringify(p)); }
function setLiveBadge(on) { const el = document.getElementById('postModeBadge'); if (on) { el.className = 'post-mode live'; el.innerHTML = '<i class="fas fa-tower-broadcast"></i> 实时同步'; } else { el.className = 'post-mode'; el.innerHTML = '<i class="fas fa-hard-drive"></i> 本机暂存'; } }
function setSubText(on) { document.getElementById('postSubText').innerHTML = on ? '分析之外的日常碎片。<b>已连接云端数据库</b>：发布后所有设备<b>实时同步</b>，访客也能即时看到。' : '分析之外的日常碎片。<b>云端暂时连不上</b>，已自动切到<b>本机暂存</b>（仅本机可见；恢复后自动补传并实时同步）。'; }
function postHTML(p) {
    const raw = p.content ?? p.txt ?? '';
    const isH = window.__isHTML && window.__isHTML(raw);
    const txtHtml = isH ? raw : esc(raw);
    const ptxtCls = isH ? 'ptxt ptxt-html' : 'ptxt';
    const ts = p.created_at ? new Date(p.created_at).getTime() : (p.ts || Date.now());
    const tags = (p.tags || []).map(t => `<span>#${esc(t)}</span>`).join('');
    const imgs = p.images || []; const imgHtml = imgs.map(s => `<img class="limg" src="${s}" data-img="${s}" alt="">`).join('');
    const flag = p._local ? `<span class="draft-flag">📴 本机</span>` : '';
    const mgmt = `<div class="life-mgmt"><button class="pc-m" data-life-edit="${esc(p.id)}" title="编辑"><i class="fas fa-pen"></i></button><button class="pc-m pc-m-del" data-life-del="${esc(p.id)}" data-local="${p._local ? 1 : 0}" title="删除"><i class="fas fa-trash"></i></button></div>`;
    return `<div class="post"><div class="ph"><div class="pav">历</div><div class="pinfo"><div class="who">阿历</div><div class="when">${relTime(ts)}</div></div>${flag}${mgmt}</div><div class="${ptxtCls}">${txtHtml}</div>${imgHtml}${tags ? `<div class="ptags">${tags}</div>` : ''}</div>`;
}
function mergeByTime(a, b) { return sortPosts([...a, ...b]); }
function renderPosts(posts, off) { if (!posts || !posts.length) { postList.innerHTML = off ? '<div class="no-result">离线暂存模式，先写一条存本机吧 ✍️</div>' : '<div class="no-result">还没有随笔，写第一条吧 ✍️</div>'; return; } postList.innerHTML = posts.map(postHTML).join(''); }
async function loadPosts() {
    let data = null, err = null; try { const res = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 8000); data = res.data; err = res.error; } catch (e) { err = e; }
    if (err || data === null) { cloudOK = false; setLiveBadge(false); setSubText(false); lifeList = sortPosts(loadLocal().map(x => ({ ...x, _local: true }))); renderPosts(lifeList, true); return; }
    cloudOK = true; setLiveBadge(true); setSubText(true);
    // 补传本机草稿
    const local = loadLocal(); if (local.length) { const remain = []; for (const x of local) { let ok = false; try { const r = await withTimeout(sb.from('posts').insert({ content: x.content, tags: x.tags, images: x.images || [] }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } saveLocal(remain); if (remain.length !== local.length) { try { const r2 = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 8000); if (!r2.error && r2.data) data = r2.data; } catch (e) { } } }
    seenIds.clear(); (data || []).forEach(p => seenIds.add(p.id));
    lifeList = mergeByTime(data || [], loadLocal().map(x => ({ ...x, _local: true })));
    renderPosts(lifeList, false);
}
function subscribeRT() { try { sb.channel('posts-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, pl => { if (!cloudOK) return; const p = pl.new; if (!p || seenIds.has(p.id)) return; seenIds.add(p.id); const e = postList.querySelector('.no-result'); if (e) e.remove(); postList.insertAdjacentHTML('afterbegin', postHTML(p)); }).subscribe(); } catch (e) { } }
function setLifeEditorMode(on) { postPub.innerHTML = on ? SAVE_HTML : PUB_HTML; let cb = document.getElementById('lifeCancel'); if (on && !cb) { postPub.insertAdjacentHTML('afterend', '<button class="btn btn-ghost" id="lifeCancel" style="margin-left:8px"><i class="fas fa-xmark"></i> 取消编辑</button>'); document.getElementById('lifeCancel').onclick = clearLifeEditor; } else if (!on && cb) cb.remove(); }
function clearLifeEditor() { lifeEditId = null; lifeEditLocal = false; postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs(); setLifeEditorMode(false); }
function editLife(id) { const p = lifeList.find(a => String(a.id) === String(id)); if (!p) return; lifeEditId = String(id); lifeEditLocal = !!p._local; postInput.value = toRTEHTML(p.content || ''); postTags.value = (p.tags || []).join(', '); lifeImages = (p.images || []).slice(); renderLifeThumbs(); setLifeEditorMode(true); setTimeout(() => { if (window.__rteLife) window.__rteLife.ed.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80); showToast('已进入编辑模式 · 改完点「保存修改」'); }
async function deleteLife(id, isLocal) {
    if (!confirm('确定删除这条随笔？此操作不可撤销。')) return;
    const sid = String(id);
    if (isLocal) { saveLocal(loadLocal().filter(a => String(a.id) !== sid)); }
    else { let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('posts').delete().eq('id', sid), 15000); ok = !r.error; } catch (e) { } } if (!ok) { showToast('删除失败 · 若重试仍失败，是数据库没开 posts 的「删除权限」，见 SQL'); return; } }
    if (lifeEditId === sid) clearLifeEditor();
    showToast('已删除 ✓'); loadPosts();
}
async function publishLife() {
    // ===== 编辑拦截：编辑模式走"更新" =====
    if (lifeEditId) {
        const content = (window.__rteLife && window.__rteLife.isEmpty()) ? '' : postInput.value.trim();
        const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        const imgs = lifeImages.slice();
        postPub.disabled = true; postPub.textContent = '保存中…';
        const sid = String(lifeEditId); let ok = false;
        if (lifeEditLocal) { const l = loadLocal(); const idx = l.findIndex(a => String(a.id) === sid); if (idx >= 0) { l[idx] = Object.assign({}, l[idx], { content, tags, images: imgs }); saveLocal(l); ok = true; } }
        else { for (let i = 0; i < 2 && !ok; i++) { try { const r = await withTimeout(sb.from('posts').update({ content, tags, images: imgs }).eq('id', sid), 25000); ok = !r.error; } catch (e) { } } }
        postPub.disabled = false;
        if (ok) { clearLifeEditor(); showToast('已保存修改 ✓'); loadPosts(); return; }
        postPub.innerHTML = SAVE_HTML; showToast('保存失败 · 原内容未丢失 · 若重试仍失败见 SQL'); return;
    }
    // ===== 新增逻辑 =====
    const content = (window.__rteLife && window.__rteLife.isEmpty()) ? '' : postInput.value.trim();
    if (!content && !lifeImages.length) { if (window.__rteLife) window.__rteLife.focus(); else postInput.focus(); return; }
    const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean); const imgs = lifeImages.slice(); postPub.disabled = true; postPub.textContent = '发布中…';
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('posts').insert({ content, tags, images: imgs }), 25000); ok = !res.error; } catch (e) { } }
    postPub.innerHTML = PUB_HTML; postPub.disabled = false;
    if (ok) { postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs(); showToast('已发布 ✓ 实时同步中…'); loadPosts(); return; }
    // 失败存本机
    const l = loadLocal(); l.unshift({ id: uid('LF'), content, tags, images: imgs, ts: Date.now(), created_at: new Date().toISOString(), _local: true }); saveLocal(l);
    postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs();
    cloudOK = false; setLiveBadge(false); setSubText(false); lifeList = sortPosts(l.map(x => ({ ...x, _local: true }))); renderPosts(lifeList, true);
    showToast('已保存到本机 ✓ 联网后自动补传', 6000);
}
postPub.addEventListener('click', publishLife);
function renderLifeThumbs() { document.getElementById('lifeThumbs').innerHTML = lifeImages.map((s, i) => `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmlife="${i}">&times;</button></div>`).join(''); }
document.getElementById('lifeFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; lifeImages.push(await compress(f)); } renderLifeThumbs(); e.target.value = ''; });
document.getElementById('lifeThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmlife]'); if (b) { lifeImages.splice(+b.dataset.rmlife, 1); renderLifeThumbs(); } });

/* ===== 联系方式 ===== */
const CONTACT = { wechat: { l: '微信号', v: 'chieee_ya', h: '打开微信「添加朋友」粘贴' }, qq: { l: 'QQ 号', v: '954567763', h: '打开 QQ 添加好友' }, phone: { l: '电话', v: '18271645570', h: '可直接拨打' }, email: { l: '邮箱', v: 'chift0707@gmail.com', h: '粘贴到收件人写信' } };
document.querySelector('.contact-row').addEventListener('click', async e => { const b = e.target.closest('[data-contact]'); if (!b) return; const c = CONTACT[b.dataset.contact]; if (!c) return; const ok = await copyText(c.v); showToast(`<b>${c.l}：${c.v}</b><br>${ok ? '✓ 已复制 · ' : '请手动复制 · '}${c.h}`); });

/* ===== lightbox ===== */
document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox' || e.target.closest('[data-close]')) { document.getElementById('lightbox').classList.remove('on'); lockScroll(false); setTimeout(() => document.getElementById('lbImg').src = '', 300); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.getElementById('lightbox').classList.remove('on'); lockScroll(false); } });

/* ===== 主题 / 时钟 / 回顶 ===== */
const root = document.documentElement, themeBtn = document.getElementById('themeBtn');
function setTheme(t) { root.setAttribute('data-theme', t); localStorage.setItem('chi_theme', t); themeBtn.innerHTML = t === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; }
setTheme(localStorage.getItem('chi_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
themeBtn.onclick = () => setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
const WK = ['日', '一', '二', '三', '四', '五', '六'];
function getLunar(d) { try { const p = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(d); const m = p.find(x => x.type === 'month'), day = p.find(x => x.type === 'day'); if (m && day) return '农历' + m.value + '月' + day.value; } catch (e) { } return ''; }
function greet(h) { return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
function tick() { const d = new Date(), l = getLunar(d); document.getElementById('dateText').innerHTML = `今天是 <b>${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日</b>，周${WK[d.getDay()]}${l ? '，' + l : ''} · ${greet(d.getHours())}`; const p = n => String(n).padStart(2, '0'); document.getElementById('clock').textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
tick(); setInterval(tick, 1000);
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 500), { passive: true });
toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

/* ===== 启动 ===== */
window.addEventListener('hashchange', route); renderCases(); renderCerts(); route(); subscribeRT();
/* ===== 块1：极速/离线开关 + 网络限时（纯追加·零冲突） ===== */
(function(){
  var HOSTS=['supabase.co','supabase.in'];
  var isSB=function(u){return u&&HOSTS.some(function(h){return u.indexOf(h)>=0;});};
  var _f=window.fetch.bind(window);
  window.OFFLINE = localStorage.getItem('chi_offline')==='1';
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:((input&&input.url)||'');
    if(!isSB(url)) return _f(input,init);
    if(window.OFFLINE){
      var m=((init&&init.method)||'GET').toUpperCase();
      if(m==='GET'||m==='HEAD') return Promise.resolve(new Response('[]',{status:200,headers:{'content-type':'application/json','content-range':'0-0/0'}}));
      return Promise.resolve(new Response(JSON.stringify({code:'offline',message:'offline mode'}),{status:503,headers:{'content-type':'application/json'}}));
    }
    var ctrl=new AbortController(); var t=setTimeout(function(){ctrl.abort();},2500);
    var merged; try{merged=Object.assign({},init,{signal:ctrl.signal});}catch(e){merged=init;}
    var p=_f(input,merged); p.then(function(){clearTimeout(t);},function(){clearTimeout(t);}); return p;
  };
  function paint(){var b=document.getElementById('offlineBtn');if(!b)return;b.classList.toggle('off',window.OFFLINE);b.innerHTML=window.OFFLINE?'<i class="fas fa-bolt"></i>':'<i class="fas fa-cloud"></i>';b.title=window.OFFLINE?'极速离线：点啥都秒响应，存本机；要同步云端再点一下切回':'在线模式：自动同步云端（慢时自动落本机）';}
  function toastOFF(){var t=document.createElement('div');t.className='off-toast';t.innerHTML=window.OFFLINE?'⚡ 已切到<b>极速离线</b> · 存本机，联网后自动同步':'☁️ 已切回<b>在线</b> · 正在连接云端…';document.body.appendChild(t);requestAnimationFrame(function(){t.classList.add('show');});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove();},400);},2600);}
  function mkBtn(){var tools=document.querySelector('.tools');if(!tools||document.getElementById('offlineBtn'))return;var b=document.createElement('button');b.id='offlineBtn';b.className='tool-btn';tools.insertBefore(b,tools.firstChild);paint();b.onclick=function(){window.OFFLINE=!window.OFFLINE;localStorage.setItem('chi_offline',window.OFFLINE?'1':'0');paint();toastOFF();};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mkBtn);else mkBtn();
  if(window.OFFLINE)setTimeout(toastOFF,900);
})();
/* ===== 块2：富文本排版编辑器（工厂·学习成长 + 生活随笔 共用一套） ===== */
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
    b('fa-align-left', '左对齐', 'justifyLeft'), b('fa-align-center', '居中', 'justifyCenter'), b('fa-align-right', '右对齐', 'justifyRight'), sep(),
    b('fa-quote-left', '引用', 'quote'), b('fa-list-ul', '无序列表', 'insertUnorderedList'), b('fa-list-ol', '有序列表', 'insertOrderedList'),
    b('fa-link', '链接', 'link'), b('fa-image', '图片', 'img'), b('fa-minus', '分割线', 'insertHorizontalRule'),
    b('fa-eraser', '清除格式', 'removeFormat'), b('fa-rotate-left', '撤销', 'undo'),b('fa-eraser', '清除格式', 'removeFormat'), b('fa-rotate-left', '撤销', 'undo'), 
// --- 👇 下面是新增的放大缩小按钮 ---
b('fa-plus', '放大字体', 'fontSizePlus'), b('fa-minus', '缩小字体', 'fontSizeMinus')
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
  function run(c) { try { document.execCommand('styleWithCSS', false, 'true'); } catch (e) { }
    if (c === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    else if (c === 'link') { var u = prompt('链接地址 https://…'); if (u) document.execCommand('createLink', false, u); }
    else if (c === 'img') { var ui = prompt('图片地址 https://…'); if (ui) document.execCommand('insertImage', false, ui); }
    else if (c === 'removeFormat') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }
    else document.execCommand(c, false, null);
    after(); }
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
window.__rte = makeRTE(document.getElementById('lrContent'), { ph: '正文… 支持加粗 / 列表 / 引用 / 插入图片等排版', onCtrlEnter: publishLearning });
window.__rteLife = makeRTE(document.getElementById('postInput'), { ph: '写点什么… 今天的一个小发现、一段心情。', onCtrlEnter: publishLife });
/* ===== 生活补丁 v3（追加在 app.js 最末尾 · 不删原代码 · 加载成功会闪橙字） ===== */
(function () {
  if (window.__CHI_PATCH_V3) return; window.__CHI_PATCH_V3 = 1;
  var URL = 'https://bqdhqnviozvqljigzys.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZGhxbnZpb3p2cWxqaWd6eXMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0NzgxNTI2NSwiZXhwIjoyMDYzMzkwODY1fQ.xTjGvZkPwJKvXlOlMqJGOkhOmJgCm3OoJjGqsQXZpEw';
  var sb2 = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(URL, KEY) : null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function relTime(ts) { var s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + ' 分钟前'; if (s < 86400) return Math.floor(s / 3600) + ' 小时前'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前'; var d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var LR = 'chi_lr_drafts', LF = 'chi_posts_local_v1';
  function getLR() { try { var r = JSON.parse(localStorage.getItem(LR)); return Array.isArray(r) ? r : []; } catch (e) { return []; } }
  function getLF() { try { var r = JSON.parse(localStorage.getItem(LF)); return Array.isArray(r) ? r : []; } catch (e) { return []; } }
  function setLF(a) { localStorage.setItem(LF, JSON.stringify(a)); }
  function setLR(a) { localStorage.setItem(LR, JSON.stringify(a)); }
  function pend() { return getLR().length + getLF().length; }
  function toast(h) { var t = document.createElement('div'); t.innerHTML = h; t.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#15171c;color:#fff;padding:14px 22px;border-radius:14px;font:14px/1.55 system-ui;max-width:92vw;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.4);z-index:9999'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 5600); }
  function beacon() { var d = document.createElement('div'); d.textContent = '✅ 生活补丁已加载'; d.style.cssText = 'position:fixed;left:50%;bottom:8px;transform:translateX(-50%);background:#e8730c;color:#fff;font:600 12px/1 system-ui;padding:6px 12px;border-radius:20px;z-index:9999;box-shadow:0 6px 18px rgba(0,0,0,.25)'; document.body.appendChild(d); setTimeout(function () { d.style.transition = 'opacity .6s'; d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 700); }, 4200); console.log('[chi] patch v3 loaded'); }

  /* —— 加粗/斜体/下划线：选中即生效（自维护选区 + 抢先执行 + 屏蔽旧逻辑） —— */
  var lastRange = null, TAG = { bold: 'strong', italic: 'em', underline: 'u' };
  function saveSel() { var s = getSelection(); if (s && s.rangeCount) { var r = s.getRangeAt(0), n = r.commonAncestorContainer; while (n && n.nodeType !== 1) n = n.parentNode; if (n && n.classList && n.classList.contains('rte')) lastRange = r.cloneRange(); } }
  function anc(node, tag, ed) { while (node && node !== ed) { if (node.nodeType === 1 && node.tagName === tag) return node; node = node.parentNode; } return null; }
  function qstate(c) { try { return document.queryCommandState(c); } catch (e) { return false; } }
  function contOf() { if (lastRange) { var n = lastRange.commonAncestorContainer; while (n && !(n.nodeType === 1 && n.classList && n.classList.contains('rte'))) n = n.parentNode; if (n) return n; } return document.querySelector('.rte'); }
  function toggle(cmd, tag) {
    var cont = contOf(); if (cont) cont.focus();
    if (lastRange) { var s = getSelection(); s.removeAllRanges(); s.addRange(lastRange); }
    var on = qstate(cmd);
    if (on) { try { document.execCommand(cmd, false, null); } catch (e) { } }
    else {
      var ok = false; try { ok = document.execCommand(cmd, false, null); } catch (e) { }
      if (!ok || !qstate(cmd)) {
        try {
          var sel = getSelection(), rng = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
          if (rng && !rng.collapsed) {
            var inT = anc(rng.commonAncestorContainer, tag, cont);
            if (inT) { var par = inT.parentNode; while (inT.firstChild) par.insertBefore(inT.firstChild, inT); par.removeChild(inT); }
            else { var el = document.createElement(tag); try { rng.surroundContents(el); } catch (e2) { el.appendChild(rng.extractContents()); rng.insertNode(el); } }
          }
        } catch (e3) { }
      }
    }
    saveSel();
  }
  document.addEventListener('mouseup', saveSel, true);
  document.addEventListener('keyup', saveSel, true);
  document.addEventListener('mousedown', function (e) {
    var btn = e.target.closest && e.target.closest('.rte-b[data-cmd]'); if (!btn) return;
    var cmd = btn.getAttribute('data-cmd'); if (!TAG[cmd]) return;   // 只管这三个，其余旧按钮不动
    e.preventDefault();   // 关键：不让按钮抢焦点，你框选的字才不会丢
    toggle(cmd, TAG[cmd]);
  }, true);
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.rte-b[data-cmd]'); if (!btn) return;
    var cmd = btn.getAttribute('data-cmd'); if (!TAG[cmd]) return;
    e.stopImmediatePropagation(); e.preventDefault();   // 屏蔽旧版对这三个按钮的处理
  }, true);

  /* —— 首页：最新≤4 + 生活随笔≤3 —— */
  function trimHome() { var g = document.getElementById('homeLatest'); if (!g) return; while (g.children.length > 4) g.removeChild(g.lastChild); }
  function homeLife() {
    var g = document.getElementById('homeLatest'); if (!g) return;
    var wrap = document.getElementById('homeLifeWrap');
    var list = getLF().slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).slice(0, 3);
    if (!list.length) { if (wrap) wrap.style.display = 'none'; return; }
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'homeLifeWrap'; wrap.innerHTML = '<h3 class="block-h" style="margin-top:54px"><i class="fas fa-feather-pointed" style="color:var(--accent)"></i> 生活随笔 <span class="k" style="font-family:monospace;font-size:12px;color:var(--ink-3)">LIFE</span></h3><div id="homeLife" class="posts"></div>'; g.parentNode.insertBefore(wrap, g.nextSibling); }
    wrap.style.display = '';
    wrap.querySelector('#homeLife').innerHTML = list.map(function (p) {
      var raw = p.content || '', isH = /<[a-z][\s\S]*>/i.test(raw), body = isH ? raw : esc(raw);
      var ts = p.created_at ? new Date(p.created_at).getTime() : (p.ts || Date.now());
      var tags = (p.tags || []).map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('');
      return '<div class="post"><div class="ph"><div class="pav">历</div><div class="pinfo"><div class="who">阿历</div><div class="when">' + relTime(ts) + '</div></div></div><div class="ptxt' + (isH ? ' ptxt-html' : '') + '">' + body + '</div>' + (tags ? '<div class="ptags">' + tags + '</div>' : '') + '</div>';
    }).join('');
  }
  function watchHome() { var g = document.getElementById('homeLatest'); if (g && !g.__mo) { new MutationObserver(function () { trimHome(); homeLife(); }).observe(g, { childList: true }); g.__mo = 1; } trimHome(); homeLife(); }
  window.addEventListener('hashchange', function () { setTimeout(watchHome, 300); });

  /* —— 同步角标 + 一键上传（带真实失败原因） —— */
  function badge() { var t = document.querySelector('.tools'); if (!t) return; var b = document.getElementById('syncBadge2'); if (!b) { b = document.createElement('button'); b.id = 'syncBadge2'; b.className = 'tool-btn'; b.style.cssText = 'width:42px;height:42px;border-radius:50%;border:1px solid var(--line,#e9ebf0);background:var(--panel,#fff);color:var(--ink-2,#4a4f5a);cursor:pointer;display:grid;place-items:center;font-size:14px;box-shadow:0 10px 30px rgba(20,23,28,.07)'; t.insertBefore(b, t.firstChild); b.onclick = flush; } paint(b); }
  function paint(b) { b = b || document.getElementById('syncBadge2'); if (!b) return; var n = pend(); if (n > 0) { b.style.background = 'var(--accent,#e8730c)'; b.style.color = '#fff'; b.style.borderColor = 'var(--accent,#e8730c)'; b.innerHTML = '<i class="fas fa-rotate"></i> ' + n; b.title = '有 ' + n + ' 篇在本机，点击上传云端'; } else { b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; b.innerHTML = '<i class="fas fa-cloud"></i>'; b.title = '全部已同步'; } }
  async function flush() {
    if (!sb2) { toast('同步组件未就绪'); return; }
    if (window.OFFLINE) { toast('当前是⚡极速离线，点右上角云切回在线再同步'); return; }
    toast('正在上传本机内容…');
    var lf = getLF(), lr = getLR(), lfR = [], lrR = [], lastErr = '';
    for (var i = 0; i < lf.length; i++) { var x = lf[i], ok = false; try { var r = await sb2.from('posts').insert({ content: x.content, tags: x.tags, images: x.images || [] }); ok = !r.error; if (!ok) lastErr = (r.error && r.error.message) || ''; } catch (e) { lastErr = e.message || ''; } if (!ok) lfR.push(x); }
    for (var j = 0; j < lr.length; j++) { var y = lr[j], ok2 = false; try { var r2 = await sb2.from('learning').insert({ title: y.title, content: y.content, images: y.images, links: y.links, tags: y.tags, emoji: y.emoji || '📝' }); ok2 = !r2.error; if (!ok2) lastErr = (r2.error && r2.error.message) || ''; } catch (e) { lastErr = e.message || ''; } if (!ok2) lrR.push(y); }
    setLF(lfR); setLR(lrR); paint();
    var done = (lf.length - lfR.length) + (lr.length - lrR.length), left = lfR.length + lrR.length;
    if (left === 0) toast('全部已同步云端 ✓');
    else toast('传上 ' + done + ' 篇，仍有 ' + left + ' 篇失败：' + (lastErr || '网络') + '（截图发我，多半是数据库权限，见下）');
  }
  window.addEventListener('online', function () { if (!window.OFFLINE) flush(); });
  setInterval(function () { if (!window.OFFLINE && pend() > 0) flush(); }, 60000);

  function start() { beacon(); badge(); watchHome(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setTimeout(function () { watchHome(); paint(); }, 1200);
})();
/* ===== 字号修复补丁 v4（追加在最末尾 · 兼容 v3） ===== */
(function () {
  if (window.__CHI_FS_FIX) return; window.__CHI_FS_FIX = 1;
  function ancFS(node, ed) {
    while (node && node !== ed) {
      if (node.nodeType === 1 && node.style && node.style.fontSize) return node;
      node = node.parentNode;
    }
    return null;
  }
  function unwrapFS(el) {
    var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el);
  }
  document.addEventListener('mousedown', function (e) {
    var btn = e.target.closest && e.target.closest('.rte-mi[data-sub]'); if (!btn) return;
    var sub = btn.getAttribute('data-sub') || ''; if (sub.indexOf('fs:') !== 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var sz = sub.split(':')[1];
    var cont = (function () {
      var s = getSelection(); if (s && s.rangeCount) {
        var n = s.getRangeAt(0).commonAncestorContainer;
        while (n && !(n.nodeType === 1 && n.classList && n.classList.contains('rte'))) n = n.parentNode;
        if (n) return n;
      }
      return document.querySelector('.rte');
    })();
    if (cont) cont.focus();
    var sel = getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var rng = sel.getRangeAt(0);
    // 1) 清除选区内所有带 fontSize 的 span
    var walker = document.createTreeWalker(rng.commonAncestorContainer, NodeFilter.SHOW_ELEMENT, null);
    var nodes = [], cur = walker.currentNode;
    while (cur) { if (rng.intersectsNode(cur) && cur.style && cur.style.fontSize) nodes.push(cur); cur = walker.nextNode(); }
    nodes.forEach(unwrapFS);
    // 2) 重新包裹整个选区
    try {
      var span = document.createElement('span'); span.style.fontSize = sz;
      rng.surroundContents(span);
    } catch (err) {
      // 跨节点选区兜底：提取→包→插回
      var frag = rng.extractContents();
      var span2 = document.createElement('span'); span2.style.fontSize = sz;
      span2.appendChild(frag); rng.insertNode(span2);
    }
    // 3) 同步隐藏 textarea
    var ta = cont.parentNode && cont.parentNode.querySelector('textarea');
    if (ta) {
      var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(ta, cont.innerHTML);
    }
  }, true);
  console.log('[chi] fontsize fix v4 loaded');
})();
/* === 新增：编辑器字体放大/缩小功能补丁 === */
(function() {
    // 1. 定义添加按钮的函数
    function addResizeButtons(toolbar) {
        if (!toolbar || toolbar.querySelector('.btn-resize')) return; // 防止重复添加

        // 创建放大按钮
        var btnPlus = document.createElement('button');
        btnPlus.type = 'button';
        btnPlus.className = 'rte-btn btn-resize'; // 复用原有样式类
        btnPlus.innerHTML = '<i class="fa fa-plus"></i> A+'; 
        btnPlus.title = '放大字号';
        
        // 创建缩小按钮
        var btnMinus = document.createElement('button');
        btnMinus.type = 'button';
        btnMinus.className = 'rte-btn btn-resize';
        btnMinus.innerHTML = '<i class="fa fa-minus"></i> A-';
        btnMinus.title = '缩小字号';

        // 点击事件逻辑
        btnPlus.onclick = function() { changeFontSize(1); };
        btnMinus.onclick = function() { changeFontSize(-1); };

        // 插入到工具栏最后
        toolbar.appendChild(btnPlus);
        toolbar.appendChild(btnMinus);
    }

    // 2. 定义改变字号的核心逻辑
    function changeFontSize(direction) {
        // 获取当前选区或光标位置
        var selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        var range = selection.getRangeAt(0);
        var node = selection.anchorNode;
        
        // 如果选中的是文本节点，取其父元素；否则直接取选中元素
        var targetElement = (node.nodeType === 3) ? node.parentNode : node;
        
        // 确保我们在编辑器内部操作
        if (!targetElement.closest('.rte-ed')) return;

        // 获取当前字号 (px)，如果没有则默认为 16px
        var currentSize = parseInt(window.getComputedStyle(targetElement).fontSize);
        if (isNaN(currentSize)) currentSize = 16;

        // 计算新字号 (步长为 2px)
        var newSize = currentSize + (direction * 2);
        
        // 限制最小和最大字号
        if (newSize < 12) newSize = 12;
        if (newSize > 72) newSize = 72;

        // 应用新样式
        // 注意：这里使用 execCommand 的 fontSize 命令比较局限，
        // 对于这种简易编辑器，直接操作 style 更稳妥。
        // 我们尝试用 span 包裹或者直接修改当前段落样式
        
        // 简易方案：修改当前所在段落的 style
        // 如果能找到最近的 p, div, li, h1-h6
        var blockParent = targetElement.closest('p, div, li, h1, h2, h3, h4, h5, h6, span');
        
        if (blockParent && blockParent.closest('.rte-ed')) {
            blockParent.style.fontSize = newSize + 'px';
        } else {
            // 如果没找到块级元素，尝试插入一个 span (处理纯文本情况)
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('fontSize', false, '7'); // 先设个大的
            var fonts = document.querySelectorAll('font[size="7"]');
            for(var i=0; i<fonts.length; i++) {
                fonts[i].removeAttribute('size');
                fonts[i].style.fontSize = newSize + 'px';
            }
        }
    }

    // 3. 执行注入 (针对页面上已存在的和未来可能生成的编辑器)
    // 这里的 '__rte' 和 '__rteLife' 是你截图中第 393/394 行定义的变量
    setTimeout(function(){
        if (window.__rte && window.__rte.ed) {
            var tb1 = window.__rte.ed.previousElementSibling; // 通常工具栏在编辑器前面
            if(tb1 && tb1.classList.contains('rte-tb')) addResizeButtons(tb1);
        }
        if (window.__rteLife && window.__rteLife.ed) {
            var tb2 = window.__rteLife.ed.previousElementSibling;
            if(tb2 && tb2.classList.contains('rte-tb')) addResizeButtons(tb2);
        }
    }, 1000); // 延迟1秒执行，确保页面加载完毕
})();
/* === 安全版：字体大小调整补丁 === */
window.addEventListener('load', function() {
    // 延迟 1 秒执行，确保页面所有元素都加载完了再动刀，防止报错
    setTimeout(function() {
        var toolbars = document.querySelectorAll('.rte-tb'); 
        
        if(toolbars.length > 0) {
            toolbars.forEach(function(tb) {
                // 如果已经加过了，就不加了
                if (tb.querySelector('.btn-font-plus')) return; 

                // 创建放大按钮
                var btnPlus = document.createElement('button');
                btnPlus.type = 'button';
                btnPlus.className = 'rte-btn btn-font-plus'; // 加上特殊类名方便识别
                btnPlus.innerHTML = '<i class="fa fa-plus"></i> A+'; 
                btnPlus.title = '放大字号';
                
                // 创建缩小按钮
                var btnMinus = document.createElement('button');
                btnMinus.type = 'button';
                btnMinus.className = 'rte-btn btn-font-minus';
                btnMinus.innerHTML = '<i class="fa fa-minus"></i> A-'; 
                btnMinus.title = '缩小字号';

                // 插入到工具栏最后
                tb.appendChild(btnPlus);
                tb.appendChild(btnMinus);

                // === 核心功能逻辑 ===
                // 点击放大
                btnPlus.onclick = function(e) {
                    e.preventDefault();
                    // 找到当前正在输入的编辑框
                    var editor = document.querySelector('.rte-editable[contenteditable="true"]');
                    if(editor) {
                        // 获取当前字号，如果没有则默认为 16px
                        var currentSize = parseInt(window.getComputedStyle(editor).fontSize);
                        if(currentSize < 30) { // 限制最大不超过 30px
                            editor.style.fontSize = (currentSize + 2) + 'px';
                        }
                    }
                };

                // 点击缩小
                btnMinus.onclick = function(e) {
                    e.preventDefault();
                    var editor = document.querySelector('.rte-editable[contenteditable="true"]');
                    if(editor) {
                        var currentSize = parseInt(window.getComputedStyle(editor).fontSize);
                        if(currentSize > 12) { // 限制最小不小于 12px
                            editor.style.fontSize = (currentSize - 2) + 'px';
                        }
                    }
                };
            });
        }
    }, 1000); // 这里的 1000 代表 1000毫秒（1秒）
});
