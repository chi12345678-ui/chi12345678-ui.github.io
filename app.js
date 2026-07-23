/* ===== 云端 ===== */
const SUPABASE_URL = 'https://bqdhqnviozvqljigzys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZGhxbnZpb3p2cWxqaWd6eXMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0NzgxNTI2NSwiZXhwIjoyMDYzMzkwODY1fQ.xTjGvZkPwJKvXlOlMqJGOkhOmJgCm3OoJjGqsQXZpEw';
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
    const pc = e.target.closest('.postcard'); if (pc) { e.preventDefault(); go('read/' + encodeURIComponent(pc.dataset.id)); return; }
    const limg = e.target.closest('.limg'); if (limg) { openLB(limg.dataset.img || limg.src); return; }
    const a = e.target.closest('a[href^="#"]'); if (a) { e.preventDefault(); go(a.getAttribute('href').slice(1)); }
});

/* ===== 项目案例（演示+分析 双文档） ===== */
const CASES = [
    { color: 'linear-gradient(135deg,#e8730c,#ff9d4d)', icon: 'fa-layer-group', tag: 'USER VALUE', title: 'RFM 用户价值分析案例', desc: '基于 SQL 取数 + Python(Pandas) 构建 RFM 模型，对线上平台用户做三维度打分与分层，输出可复现的交互式分析报告。', tech: ['SQL', 'Python', 'Pandas', 'Jupyter'], docs: [{ label: '交互式报告', href: '线上平台用户RFM分析.html' }], dl: '线上平台用户RFM分析.ipynb' },
    { color: 'linear-gradient(135deg,#2f6fed,#5b8def)', icon: 'fa-boxes-stacked', tag: 'INVENTORY', title: '快消品进销存分析', desc: '以 Power BI 完成数据建模与清洗，搭建进销存看板 + 分析报告：监控库存、月销与临期风险，完成 ABC 动销与智能补货诊断。', tech: ['Power BI', 'DAX'], docs: [{ label: '演示案例', href: '快消品进销存演示案例.pdf' }, { label: '分析报告', href: '快消品进销存分析报告.pdf' }], dl: '快消品进销存演示案例.pbix' },
    { color: 'linear-gradient(135deg,#8b5cf6,#a78bfa)', icon: 'fa-rotate', tag: 'RETENTION · LTV', title: '复购与留存分析', desc: '复购专题双报告：销售趋势、留存、新增/复购拆解，以及母婴店铺「黄金60天」转化归因，核心度量以 DAX 实现。', tech: ['Power BI', 'DAX', '归因分析'], docs: [{ label: '演示案例', href: '复购分析案例.pdf' }, { label: '分析报告', href: '复购分析报告.pdf' }], dl: '复购分析案例.pbix' }
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
    { id: 'seed-3', title: '转行数据分析这一年，我踩过的 5 个认知坑', content: '一年前我还在为 VLOOKUP 焦虑。今天聊的不是函数，是差点让我放弃的认知坑。\n\n1 把"会工具"当"会分析"。2 一上来就建模。3 不敢问业务。4 报告写给自己看。5 只输入不输出。\n\n这个博客就是逼自己输出的产物——写出来，才算真的会。这条路不卷速度，卷持续。', images: [], links: [], tags: ['转行', '成长', '随笔'], emoji: '🌱', created_at: '2026-06-28T09:00:00Z' }
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
            return { ok: true };
        }
        // 云端不通：seed + 本机草稿
        learningList = sortPosts([...SEED_LEARNING, ...getLR().map(x => ({ ...x, _local: true }))]);
        return { ok: true };
    })();
}
function invalidateLearning() { _lp = null; }
function cardHTML(p, i) {
    const ts = p.created_at ? new Date(p.created_at).getTime() : Date.now();
    const imgs = p.images || []; const cover = imgs[0] ? `background-image:url('${imgs[0]}')` : `background:${GRADS[i % GRADS.length]}`;
    const tags = (p.tags || []).slice(0, 3).map(t => `<span>${esc(t)}</span>`).join('');
    const ex = (p.content || '').replace(/https?:\/\/\S+/g, '').slice(0, 90);
    const flag = p._local ? `<span class="draft-flag">📴 本机</span><button class="sync-btn" data-sync="${esc(p.id)}" title="同步到云端"><i class="fas fa-rotate"></i></button>` : '';
    return `<article class="postcard" data-id="${esc(p.id)}">${flag}<div class="pc-cover" style="${cover}"><span class="pc-emoji">${p.emoji || '📝'}</span><span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span></div><div class="pc-body"><h3>${esc(p.title || '无标题')}</h3><p class="pc-ex">${esc(ex)}</p><div class="pc-tags">${tags}</div></div></article>`;
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
    const bar = preview ? `<div class="preview-bar"><i class="fas fa-eye"></i> 这是预览，尚未发布。<span class="back-link" id="backEdit" style="margin:0"><i class="fas fa-pen"></i> 返回编辑</span></div>` : `<div class="back-link" id="backList"><i class="fas fa-arrow-left"></i> 返回学习成长</div>`;
    document.getElementById('readInner').innerHTML = `${bar}${localBar}<article class="article"><h1 class="article-title">${esc(p.title || '无标题')}</h1><div class="article-meta"><span>${fmtDate(p.created_at || new Date().toISOString())}</span>${tags}</div><div class="article-body">${linkify(p.content || '')}</div>${gallery}${refs}${nav}</article>`;
    document.getElementById('readInner').querySelectorAll('.gal-item').forEach(g => g.onclick = () => openLB(g.dataset.img));
    const bl = document.getElementById('backList'); if (bl) bl.onclick = () => go('learning');
    const be = document.getElementById('backEdit'); if (be) be.onclick = () => go('learning');
    const sn = document.getElementById('syncNow'); if (sn) sn.onclick = () => resyncOne(p.id);
    document.getElementById('readInner').querySelectorAll('.an[data-id]').forEach(a => a.onclick = () => go('read/' + a.dataset.id));
}

/* ===== 学习成长：编辑器 ===== */
let lrImages = [], lrLinks = [];
function renderThumbs() { document.getElementById('lrThumbs').innerHTML = lrImages.map((s, i) => `<div class="lr-thumb"><img src="${s}" alt=""><button data-rmimg="${i}">&times;</button></div>`).join(''); }
function renderLinkList() { document.getElementById('lrLinkList').innerHTML = lrLinks.map((l, i) => `<div class="lr-linkitem"><i class="lk fas fa-link"></i><span class="lt">${esc(l.text || l.url)}<small>${esc(l.url)}</small></span><button data-rmlink="${i}"><i class="fas fa-times"></i></button></div>`).join(''); }
document.getElementById('lrFile').addEventListener('change', async e => { const files = [...e.target.files]; for (const f of files) { if (!f.type.startsWith('image/')) continue; lrImages.push(await compress(f)); } renderThumbs(); e.target.value = ''; });
document.getElementById('lrThumbs').addEventListener('click', e => { const b = e.target.closest('[data-rmimg]'); if (b) { lrImages.splice(+b.dataset.rmimg, 1); renderThumbs(); } });
document.getElementById('lrAddLink').addEventListener('click', () => { const t = document.getElementById('lrLinkText'), u = document.getElementById('lrLinkUrl'); const url = u.value.trim(); if (!url) { u.focus(); return; } lrLinks.push({ text: t.value.trim() || url, url }); t.value = ''; u.value = ''; renderLinkList(); });
document.getElementById('lrLinkList').addEventListener('click', e => { const b = e.target.closest('[data-rmlink]'); if (b) { lrLinks.splice(+b.dataset.rmlink, 1); renderLinkList(); } });
function gatherPost() { return { title: document.getElementById('lrTitle').value.trim(), content: document.getElementById('lrContent').value.trim(), images: lrImages.slice(), links: lrLinks.slice(), tags: document.getElementById('lrTags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean) }; }
document.getElementById('lrPreview').addEventListener('click', () => { const p = gatherPost(); if (!p.title && !p.content) { showToast('先写点标题或正文再预览'); return; } renderRead({ ...p, created_at: new Date().toISOString(), emoji: '👀' }, true); showView('read'); setNav('learning'); });
document.getElementById('lrPub').addEventListener('click', publishLearning);
document.getElementById('lrContent').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); publishLearning(); } });
async function publishLearning() {
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

/* ===== 生活随笔：实时同步 + 本机兜底 + 自动补传 ===== */
const postList = document.getElementById('postList'), postInput = document.getElementById('postInput'), postTags = document.getElementById('postTags'), postPub = document.getElementById('postPub');
const PUB_HTML = postPub.innerHTML, seenIds = new Set(), LKEY = 'chi_posts_local_v1'; let cloudOK = true, lifeImages = [];
const SEED_LIFE = [{ id: 'sl1', content: '今天把进销存看板的"该补货吗"挪到了第一屏。看板的第一屏只该回答一个问题。', tags: ['复盘'], images: [], created_at: '2026-07-20T21:30:00Z' }, { id: 'sl2', content: '周末给草缸换了水，顺便把网球拍线也换了。生活和分析一样，定期维护才不会崩。🎾', tags: ['生活'], images: [], created_at: '2026-07-13T18:00:00Z' }];
function loadLocal() { try { const r = JSON.parse(localStorage.getItem(LKEY)); if (Array.isArray(r)) return r; } catch (e) { } return []; }
function saveLocal(p) { localStorage.setItem(LKEY, JSON.stringify(p)); }
function setLiveBadge(on) { const el = document.getElementById('postModeBadge'); if (on) { el.className = 'post-mode live'; el.innerHTML = '<i class="fas fa-tower-broadcast"></i> 实时同步'; } else { el.className = 'post-mode'; el.innerHTML = '<i class="fas fa-hard-drive"></i> 本机暂存'; } }
function setSubText(on) { document.getElementById('postSubText').innerHTML = on ? '分析之外的日常碎片。<b>已连接云端数据库</b>：发布后所有设备<b>实时同步</b>，访客也能即时看到。' : '分析之外的日常碎片。<b>云端暂时连不上</b>，已自动切到<b>本机暂存</b>（仅本机可见；恢复后自动补传并实时同步）。'; }
function postHTML(p) { const txt = esc(p.content ?? p.txt ?? ''); const ts = p.created_at ? new Date(p.created_at).getTime() : (p.ts || Date.now()); const tags = (p.tags || []).map(t => `<span>#${esc(t)}</span>`).join(''); const imgs = p.images || []; const imgHtml = imgs.map(s => `<img class="limg" src="${s}" data-img="${s}" alt="">`).join(''); const flag = p._local ? `<span class="draft-flag">📴 本机</span>` : ''; return `<div class="post">${flag}<div class="ph"><div class="pav">历</div><div><div class="who">阿历</div><div class="when">${relTime(ts)}</div></div></div><div class="ptxt">${txt}</div>${imgHtml}${tags ? `<div class="ptags">${tags}</div>` : ''}</div>`; }
function mergeByTime(a, b) { return sortPosts([...a, ...b]); }
function renderPosts(posts, off) { if (!posts || !posts.length) { postList.innerHTML = off ? '<div class="no-result">离线暂存模式，先写一条存本机吧 ✍️</div>' : '<div class="no-result">还没有随笔，写第一条吧 ✍️</div>'; return; } postList.innerHTML = posts.map(postHTML).join(''); }
async function loadPosts() {
    let data = null, err = null; try { const res = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 8000); data = res.data; err = res.error; } catch (e) { err = e; }
    if (err || data === null) { cloudOK = false; setLiveBadge(false); setSubText(false); renderPosts(sortPosts(loadLocal().map(x => ({ ...x, _local: true }))), true); return; }
    cloudOK = true; setLiveBadge(true); setSubText(true);
    // 补传本机草稿
    const local = loadLocal(); if (local.length) { const remain = []; for (const x of local) { let ok = false; try { const r = await withTimeout(sb.from('posts').insert({ content: x.content, tags: x.tags, images: x.images || [] }), 15000); ok = !r.error; } catch (e) { } if (!ok) remain.push(x); } saveLocal(remain); if (remain.length !== local.length) { try { const r2 = await withTimeout(sb.from('posts').select('*').order('created_at', { ascending: false }).limit(100), 8000); if (!r2.error && r2.data) data = r2.data; } catch (e) { } } }
    seenIds.clear(); (data || []).forEach(p => seenIds.add(p.id));
    renderPosts(mergeByTime(data || [], loadLocal().map(x => ({ ...x, _local: true }))), false);
}
function subscribeRT() { try { sb.channel('posts-rt').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, pl => { if (!cloudOK) return; const p = pl.new; if (!p || seenIds.has(p.id)) return; seenIds.add(p.id); const e = postList.querySelector('.no-result'); if (e) e.remove(); postList.insertAdjacentHTML('afterbegin', postHTML(p)); }).subscribe(); } catch (e) { } }
async function publishLife() {
    const content = postInput.value.trim(); if (!content && !lifeImages.length) { postInput.focus(); return; } const tags = postTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean); const imgs = lifeImages.slice(); postPub.disabled = true; postPub.textContent = '发布中…';
    let ok = false; for (let i = 0; i < 2 && !ok; i++) { try { const res = await withTimeout(sb.from('posts').insert({ content, tags, images: imgs }), 25000); ok = !res.error; } catch (e) { } }
    postPub.innerHTML = PUB_HTML; postPub.disabled = false;
    if (ok) { postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs(); showToast('已发布 ✓ 实时同步中…'); loadPosts(); return; }
    // 失败存本机
    const l = loadLocal(); l.unshift({ id: uid('LF'), content, tags, images: imgs, ts: Date.now(), created_at: new Date().toISOString(), _local: true }); saveLocal(l);
    postInput.value = ''; postTags.value = ''; lifeImages = []; renderLifeThumbs();
    cloudOK = false; setLiveBadge(false); setSubText(false); renderPosts(sortPosts(l.map(x => ({ ...x, _local: true }))), true);
    showToast('已保存到本机 ✓ 联网后自动补传', 6000);
}
postPub.addEventListener('click', publishLife);
postInput.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); publishLife(); } });
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
renderCases(); renderCerts(); route(); subscribeRT();
