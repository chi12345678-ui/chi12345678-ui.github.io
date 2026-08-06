/* ===== 云端（带"加载失败也不崩"保险） ===== */
const SUPABASE_URL = 'https://bqdhqnviovzqljjigzys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
let sb = null;
try { sb = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null; } catch(e){ sb = null; }

/* ===== 工具 ===== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const withTimeout = (p, ms) => Promise.race([Promise.resolve(p), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const fmtDate = iso => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`; };
const toastEl = document.getElementById('toast'); let toastTimer = null;
function showToast(h, ms=4200) { toastEl.innerHTML = h; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms); }
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a); return true; } }
function compress(file, max = 1000, q = 0.7) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(b => res(b), 'image/jpeg', q);
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ===== 农历 & 天干地支 ===== */
const Gan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const Zhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const Animals = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const lunarMonths = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const lunarDays = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

// 简化农历数据（1900-2100）
const lunarInfo = [
 0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
 0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
 0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
 0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
 0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
 0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,
 0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
 0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,
 0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
 0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
 0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
 0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
 0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
 0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
 0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0
];

function lYearDays(y) {
  let i, sum = 348;
  for (i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}
function leapDays(y) { if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29; return 0; }
function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

function solarToLunar(date) {
  let y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  if (y < 1900 || y > 2100) return null;
  let base = new Date(1900, 0, 31);
  let offset = Math.floor((date - base) / 86400000);
  let i, temp = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = lYearDays(i); offset -= temp;
  }
  if (offset < 0) { offset += temp; i--; }
  let lunarYear = i;
  let leap = leapMonth(i);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === leap + 1 && !isLeap) { i--; isLeap = true; temp = leapDays(lunarYear); }
    else { temp = monthDays(lunarYear, i); }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) { isLeap = false; } else { isLeap = true; i--; }
  }
  if (offset < 0) { offset += temp; i--; }
  let lunarMonth = i;
  let lunarDay = offset + 1;
  return {
    year: lunarYear, month: lunarMonth, day: lunarDay,
    monthStr: (isLeap ? '闰' : '') + lunarMonths[lunarMonth - 1] + '月',
    dayStr: lunarDays[lunarDay - 1],
    gzYear: Gan[(lunarYear - 4) % 10] + Zhi[(lunarYear - 4) % 12],
    animal: Animals[(lunarYear - 4) % 12]
  };
}

function updateTime() {
  const now = new Date();
  const lunar = solarToLunar(now);
  const y = now.getFullYear();
  const gz = Gan[(y - 4) % 10] + Zhi[(y - 4) % 12];
  const week = ['日','一','二','三','四','五','六'][now.getDay()];

  document.getElementById('dateStr').innerHTML = `今天是 <b>${y}年${now.getMonth()+1}月${now.getDate()}日</b> · 周${week}`;
  document.getElementById('clock').textContent = now.toLocaleTimeString('zh-CN', {hour12:false});

  if (lunar) {
    document.getElementById('lunarStr').textContent = `农历 ${lunar.monthStr}${lunar.dayStr}`;
    document.getElementById('gzStr').textContent = `${lunar.gzYear}年 · ${lunar.animal}年`;
    document.getElementById('widgetLunar').textContent = `农历 ${lunar.monthStr}${lunar.dayStr}`;
    document.getElementById('widgetGz').textContent = `${lunar.gzYear}年 · ${lunar.animal}年`;
  }
  document.getElementById('widgetClock').textContent = now.toLocaleTimeString('zh-CN', {hour12:false, hour:'2-digit', minute:'2-digit'});
  document.getElementById('widgetDate').textContent = `${now.getMonth()+1}月${now.getDate()}日 周${week}`;
}
setInterval(updateTime, 1000);
updateTime();

/* ===== 数据 ===== */
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
let projects = LS.get('projects', []);
let learning = LS.get('learning', []);
let life = LS.get('life', []);
let drafts = LS.get('drafts', []);
let editorMode = null; // 'project' | 'learning' | 'life'
let edImages = [];
let edFiles = [];
let edLinks = [];

/* ===== 主题 ===== */
const themeBtn = document.getElementById('themeBtn');
if (localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
themeBtn.onclick = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('theme', isDark ? '' : 'dark');
  themeBtn.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
};
if (document.documentElement.getAttribute('data-theme') === 'dark') themeBtn.innerHTML = '<i class="fas fa-sun"></i>';

/* ===== 离线模式 ===== */
let isOffline = !navigator.onLine;
const offlineBtn = document.getElementById('offlineBtn');
function setOffline(v) {
  isOffline = v;
  offlineBtn.classList.toggle('off', isOffline);
  offlineBtn.innerHTML = isOffline ? '<i class="fas fa-wifi-slash"></i>' : '<i class="fas fa-wifi"></i>';
  offlineBtn.title = isOffline ? '离线模式（点击切换）' : '在线模式（点击切换）';
}
window.addEventListener('online', () => setOffline(false));
window.addEventListener('offline', () => setOffline(true));
setOffline(isOffline);
offlineBtn.onclick = () => { setOffline(!isOffline); showToast(isOffline ? '已切换到离线模式' : '已切换到在线模式'); };

/* ===== 导航 ===== */
function goHome() { showView('home'); }
function historyBack() { window.history.back(); }
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === name));
  window.scrollTo({top:0, behavior:'smooth'});
  if (name === 'projects') renderProjects();
  if (name === 'learning') renderLearning();
  if (name === 'life') renderLife();
  if (name === 'archive') renderArchive();
  if (name === 'home') renderHome();
}
document.querySelectorAll('.nav a, .garden-nav a, .widget-quick a, .sec-more').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showView(a.dataset.view); history.pushState(null, '', '#' + a.dataset.view); });
});
window.addEventListener('popstate', () => {
  const hash = location.hash.replace('#','') || 'home';
  showView(hash);
});

/* ===== 回到顶部 ===== */
const toTop = document.getElementById('toTop');
window.addEventListener('scroll', () => { if (window.scrollY > 400) toTop.classList.add('show'); else toTop.classList.remove('show'); });
toTop.onclick = () => window.scrollTo({top:0, behavior:'smooth'});

/* ===== 二维码 ===== */
function showWechat() { document.getElementById('qrImg').src = 'wechat.jpg'; document.getElementById('qrText').textContent = '微信扫码添加'; document.getElementById('qrOverlay').classList.add('on'); }
function showXiaohongshu() { document.getElementById('qrImg').src = 'xiaohongshu.jpg'; document.getElementById('qrText').textContent = '小红书扫码关注'; document.getElementById('qrOverlay').classList.add('on'); }
function showQQ() { document.getElementById('qrImg').src = 'qq.jpg'; document.getElementById('qrText').textContent = 'QQ扫码添加'; document.getElementById('qrOverlay').classList.add('on'); }
function closeQr() { document.getElementById('qrOverlay').classList.remove('on'); }

/* ===== 渲染辅助 ===== */
function toRTEHTML(html) {
  if (!html) return '';
  let d = document.createElement('div'); d.innerHTML = html;
  d.querySelectorAll('img').forEach(img => { img.style.maxWidth='100%'; img.style.borderRadius='12px'; });
  return d.innerHTML;
}
function makeExcerpt(html, len=90) {
  if (!html) return '';
  const txt = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return txt.length > len ? txt.slice(0, len) + '...' : txt;
}

/* ===== 首页渲染（限制3条） ===== */
function renderHome() {
  // 项目最多3条
  const hp = projects.slice(0, 3);
  document.getElementById('homeCases').innerHTML = hp.length ? hp.map((p, i) => renderCaseCard(p, i)).join('') : '<div class="no-result">暂无项目</div>';

  // 学习最多3条
  const hl = learning.slice(0, 3);
  document.getElementById('homeLatest').innerHTML = hl.length ? hl.map(p => renderPostRow(p, 'learning')).join('') : '<div class="no-result">暂无学习笔记</div>';

  // 随笔最多3条
  const hf = life.slice(0, 3);
  document.getElementById('homeLife').innerHTML = hf.length ? hf.map(p => renderLifePost(p)).join('') : '<div class="no-result">暂无随笔</div>';

  // 统计
  document.getElementById('statProjects').textContent = projects.length;
  document.getElementById('statLearning').textContent = learning.length;
  document.getElementById('statLife').textContent = life.length;
  const start = new Date('2024-01-01');
  document.getElementById('statDays').textContent = Math.floor((Date.now() - start) / 86400000);
}

function renderCaseCard(p, i) {
  const ex = esc(p.excerpt || makeExcerpt(p.content, 80));
  const tags = (p.tags || '').split(',').filter(Boolean).slice(0, 3);
  const tagHtml = tags.map(t => `<span>${esc(t.trim())}</span>`).join('');
  const docs = (p.files || []).filter(f => f && f.name).slice(0, 2);
  const docHtml = docs.map(f => `<span class="case-doc"><i class="fas fa-file"></i> ${esc(f.name)}</span>`).join('');
  const big = String(i + 1).padStart(2, '0');
  return `<div class="case case--row" onclick="openRead('project', '${p.id}')">
    <div class="case-cover" style="background:linear-gradient(135deg, var(--accent-soft), var(--panel-2));">
      <span class="big">${big}</span>
      <span class="ctag">${esc(p.category || '案例')}</span>
    </div>
    <div class="case-body">
      <h3>${esc(p.title || '无标题')}</h3>
      <p>${ex}</p>
      ${docHtml ? `<div class="case-docs">${docHtml}</div>` : ''}
      <div class="case-foot">
        <div class="case-tech">${tagHtml}</div>
        <span class="case-dl">查看详情 <i class="fas fa-arrow-right"></i></span>
      </div>
    </div>
  </div>`;
}

function renderPostRow(p, type) {
  const isDraft = !!p._draft;
  const pinned = (p.tags || '').includes('置顶');
  const pinFlag = pinned ? `<span class="pin-flag"><i class="fas fa-thumbtack"></i> 置顶</span>` : '';
  const draftFlag = isDraft ? `<span class="draft-flag"><i class="fas fa-pencil"></i> 草稿</span>` : '';
  const imgs = p.images || [];
  const thumb = imgs.length ? imgs[0] : '';
  const ex = esc(makeExcerpt(p.content, 100));
  const tags = (p.tags || '').split(',').filter(Boolean).filter(t => t !== '置顶').slice(0, 3);
  const tagHtml = tags.map(t => `<span>${esc(t.trim())}</span>`).join('');
  return `<div class="postcard postcard--row" onclick="openRead('${type}', '${p.id}')">
    ${thumb ? `<div class="pc-thumb" style="background-image:url('${esc(thumb)}')"><span class="pc-emoji">${p.emoji || '📝'}</span></div>` : `<div class="pc-thumb" style="background:var(--panel-2);display:grid;place-items:center;font-size:48px;">${p.emoji || '📝'}</div>`}
    <div class="pc-main">
      <div class="pc-top">
        <span class="pc-date">${fmtDate(p.created_at || new Date().toISOString())}</span>
        ${pinFlag}${draftFlag}
      </div>
      <h3 class="pc-title">${esc(p.title || '无标题')}</h3>
      <p class="pc-ex">${ex}</p>
      <div class="pc-tags">${tagHtml}</div>
    </div>
    <div class="pc-mgmt" onclick="event.stopPropagation()">
      <button class="pc-m" onclick="editPost('${type}', '${p.id}')" title="编辑"><i class="fas fa-pen"></i></button>
      <button class="pc-m pc-m-del" onclick="delPost('${type}', '${p.id}')" title="删除"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function renderLifePost(p) {
  const isDraft = !!p._draft;
  const imgs = (p.images || []).slice(0, 2);
  const imgHtml = imgs.map(u => `<img src="${esc(u)}" class="limg" onclick="event.stopPropagation();openLightbox('${esc(u)}')">`).join('');
  const tags = (p.tags || '').split(',').filter(Boolean).slice(0, 3);
  return `<div class="post" onclick="openRead('life', '${p.id}')">
    <div class="ph">
      <div class="pav">历</div>
      <div class="pinfo">
        <div class="who">阿历</div>
        <div class="when">${relTime(new Date(p.created_at).getTime())}</div>
      </div>
      ${isDraft ? '<span class="draft-flag"><i class="fas fa-pencil"></i> 草稿</span>' : ''}
      <div class="life-mgmt" onclick="event.stopPropagation()">
        <button class="pc-m" onclick="editPost('life', '${p.id}')" title="编辑"><i class="fas fa-pen"></i></button>
        <button class="pc-m pc-m-del" onclick="delPost('life', '${p.id}')" title="删除"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <div class="ptxt">${toRTEHTML(p.content)}</div>
    ${imgHtml}
    ${tags.length ? `<div class="ptags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
  </div>`;
}

/* ===== 项目列表 ===== */
function renderProjects() {
  const el = document.getElementById('caseGrid');
  el.innerHTML = projects.length ? projects.map((p, i) => renderCaseCard(p, i)).join('') : '<div class="no-result">暂无项目，点击右上角「新建项目」开始创作</div>';
}

/* ===== 学习列表 ===== */
function renderLearning() {
  const el = document.getElementById('learningGrid');
  el.innerHTML = learning.length ? learning.map(p => renderPostRow(p, 'learning')).join('') : '<div class="no-result">暂无笔记，点击右上角「写学习笔记」开始记录</div>';
}

/* ===== 随笔列表 ===== */
function renderLife() {
  const el = document.getElementById('lifePosts');
  el.innerHTML = life.length ? life.map(p => renderLifePost(p)).join('') : '<div class="no-result">暂无随笔，点击右上角「写随笔」记录生活</div>';
}

/* ===== 归档 ===== */
let archiveFilter = 'all';
function setArchiveFilter(f) { archiveFilter = f; document.querySelectorAll('.archive-tab').forEach(b => b.classList.toggle('active', b.dataset.filter === f)); renderArchive(); }
function renderArchive() {
  const q = (document.getElementById('archiveSearch').value || '').toLowerCase();
  let all = [
    ...projects.map(p => ({...p, _type:'project', _typeName:'项目'})),
    ...learning.map(p => ({...p, _type:'learning', _typeName:'学习'})),
    ...life.map(p => ({...p, _type:'life', _typeName:'随笔'}))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (archiveFilter !== 'all') all = all.filter(p => p._type === archiveFilter);
  if (q) all = all.filter(p => (p.title + p.content + p.tags).toLowerCase().includes(q));

  const el = document.getElementById('archiveList');
  if (!all.length) { el.innerHTML = '<div class="no-result">没有找到相关内容</div>'; return; }

  // 按类型分组
  const groups = {};
  all.forEach(p => { const k = p._typeName; if (!groups[k]) groups[k] = []; groups[k].push(p); });

  el.innerHTML = Object.entries(groups).map(([name, items]) => `
    <div class="archive-folder">
      <div class="archive-folder-h"><span class="archive-folder-icon">📁</span> ${name} <span class="archive-folder-count">${items.length}</span></div>
      <div class="archive-folder-items">
        ${items.map(p => `
          <div class="archive-item" onclick="openRead('${p._type}', '${p.id}')">
            <span class="archive-item-emoji">${p.emoji || '📝'}</span>
            <div class="archive-item-main">
              <div class="archive-item-title">${esc(p.title || '无标题')}</div>
              <div class="archive-item-meta">${fmtDate(p.created_at)} ${(p.tags || '').split(',').filter(Boolean).slice(0,2).map(t => `<span class="archive-tag">${esc(t)}</span>`).join('')}</div>
            </div>
            <i class="fas fa-chevron-right archive-item-arrow"></i>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

/* ===== 文章详情 ===== */
function openRead(type, id) {
  let p;
  if (type === 'project') p = projects.find(x => x.id === id);
  else if (type === 'learning') p = learning.find(x => x.id === id);
  else p = life.find(x => x.id === id);
  if (!p) return;

  const isHTML = window.__isHTML && window.__isHTML(p.content);
  const txt = p.content || '';
  const imgs = p.images || [];
  const files = p.files || [];
  const links = p.links || [];
  const tags = (p.tags || '').split(',').filter(Boolean);

  let html = '';
  html += `<h1 class="article-title">${esc(p.title || '无标题')}</h1>`;
  html += `<div class="article-meta">
    <span>${fmtDate(p.created_at)}</span>
    <span class="mtag">${type === 'project' ? '项目' : type === 'learning' ? '学习' : '随笔'}</span>
    ${tags.map(t => `<span class="mtag">${esc(t)}</span>`).join('')}
  </div>`;

  if (files.length) {
    html += `<div style="margin-bottom:24px"><h4 style="font-size:16px;margin-bottom:12px"><i class="fas fa-paperclip" style="color:var(--accent)"></i> 附件下载</h4>`;
    html += files.map(f => `<a href="${esc(f.url || '#')}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line);margin-right:8px;margin-bottom:8px;font-size:14px;font-weight:600"><i class="fas fa-file" style="color:var(--accent)"></i> ${esc(f.name)} ${f.size ? `<small style="color:var(--ink-3)">(${(f.size/1024/1024).toFixed(1)} MB)</small>` : ''}</a>`).join('');
    html += `</div>`;
  }

  html += `<div class="article-body">${isHTML ? txt : toRTEHTML(txt)}</div>`;

  if (imgs.length) {
    html += `<div class="article-gallery">${imgs.map(u => `<div class="gal-item" onclick="openLightbox('${esc(u)}')"><img src="${esc(u)}" alt=""></div>`).join('')}</div>`;
  }

  if (links.length) {
    html += `<div class="article-refs"><h4><i class="fas fa-link"></i> 参考链接</h4>`;
    html += links.map(l => `<a class="ref-card" href="${esc(l.url)}" target="_blank"><i class="fas fa-external-link-alt"></i><span><b>${esc(l.title || '链接')}</b><small>${esc(l.url)}</small></span><i class="fas fa-arrow-right"></i></a>`).join('');
    html += `</div>`;
  }

  document.getElementById('readContent').innerHTML = html;
  showView('read');
  history.pushState(null, '', '#read');
}

/* ===== 编辑器弹窗 ===== */
function openEditor(mode) {
  editorMode = mode;
  const titles = { project: '新建项目', learning: '写学习笔记', life: '写随笔' };
  document.getElementById('editorTitle').textContent = titles[mode] || '新建内容';
  document.getElementById('edTitle').value = '';
  document.getElementById('rte').innerHTML = '';
  document.getElementById('edTags').value = '';
  edImages = []; edFiles = []; edLinks = [];
  renderEdThumbs(); renderEdFiles(); renderEdLinks();
  document.getElementById('editorOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeEditor() {
  document.getElementById('editorOverlay').classList.remove('on');
  document.body.style.overflow = '';
  editorMode = null;
}
function editPost(type, id) {
  let p;
  if (type === 'project') p = projects.find(x => x.id === id);
  else if (type === 'learning') p = learning.find(x => x.id === id);
  else p = life.find(x => x.id === id);
  if (!p) return;
  editorMode = type;
  document.getElementById('editorTitle').textContent = '编辑内容';
  document.getElementById('edTitle').value = p.title || '';
  document.getElementById('rte').innerHTML = p.content || '';
  document.getElementById('edTags').value = p.tags || '';
  edImages = [...(p.images || [])];
  edFiles = [...(p.files || [])];
  edLinks = [...(p.links || [])];
  renderEdThumbs(); renderEdFiles(); renderEdLinks();
  document.getElementById('editorOverlay').classList.add('on');
  document.body.style.overflow = 'hidden';
  // 保存原始ID以便更新
  document.getElementById('edSubmit').dataset.editId = id;
}

/* 编辑器图片 */
async function edHandleImages(input) {
  const files = Array.from(input.files || []);
  for (const f of files) {
    try { const blob = await compress(f, 1200, 0.75); const url = URL.createObjectURL(blob); edImages.push(url); }
    catch(e) { showToast('图片处理失败: ' + e.message); }
  }
  renderEdThumbs(); input.value = '';
}
function renderEdThumbs() {
  document.getElementById('edThumbs').innerHTML = edImages.map((u, i) => `
    <div class="lr-thumb"><img src="${esc(u)}"><button onclick="edImages.splice(${i},1);renderEdThumbs()"><i class="fas fa-times"></i></button></div>
  `).join('');
}

/* 编辑器附件 */
function edHandleFiles(input) {
  const files = Array.from(input.files || []);
  files.forEach(f => { edFiles.push({ name: f.name, size: f.size, url: URL.createObjectURL(f), file: f }); });
  renderEdFiles(); input.value = '';
}
function renderEdFiles() {
  document.getElementById('edAttachments').innerHTML = edFiles.map((f, i) => `
    <div class="lr-attach-item"><i class="fas fa-file"></i><span>${esc(f.name)} ${f.size ? `<small>(${(f.size/1024/1024).toFixed(1)} MB)</small>` : ''}</span><button onclick="edFiles.splice(${i},1);renderEdFiles()"><i class="fas fa-times"></i></button></div>
  `).join('');
}

/* 编辑器链接 */
function edAddLink() {
  const t = document.getElementById('edLinkTitle').value.trim();
  const u = document.getElementById('edLinkUrl').value.trim();
  if (!u) return showToast('请输入链接地址');
  edLinks.push({ title: t || u, url: u });
  document.getElementById('edLinkTitle').value = '';
  document.getElementById('edLinkUrl').value = '';
  renderEdLinks();
}
function renderEdLinks() {
  document.getElementById('edLinks').innerHTML = edLinks.map((l, i) => `
    <div class="lr-linkitem"><i class="fas fa-link lk"></i><span class="lt">${esc(l.title)}<small>${esc(l.url)}</small></span><button onclick="edLinks.splice(${i},1);renderEdLinks()"><i class="fas fa-times"></i></button></div>
  `).join('');
}

/* 富文本命令 */
function rteCmd(cmd, val) { document.execCommand(cmd, false, val); document.getElementById('rte').focus(); }
function rteLink() { const url = prompt('输入链接地址:'); if (url) rteCmd('createLink', url); }
function rteImage() { const url = prompt('输入图片地址:'); if (url) { rteCmd('insertImage', url); } }

/* 发布 */
async function edSubmit() {
  const title = document.getElementById('edTitle').value.trim();
  const content = document.getElementById('rte').innerHTML.trim();
  const tags = document.getElementById('edTags').value.trim();
  const editId = document.getElementById('edSubmit').dataset.editId;
  if (!title && !content) return showToast('标题和内容不能都为空');

  const payload = {
    id: editId || 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title, content, tags,
    images: edImages,
    files: edFiles.map(f => ({ name: f.name, size: f.size, url: f.url })),
    links: edLinks,
    created_at: editId ? (projects.find(x=>x.id===editId)||learning.find(x=>x.id===editId)||life.find(x=>x.id===editId)).created_at : new Date().toISOString(),
    emoji: editorMode === 'project' ? '💼' : editorMode === 'learning' ? '📚' : '🌱',
    category: editorMode === 'project' ? '项目' : editorMode === 'learning' ? '学习' : '随笔'
  };

  if (editId) {
    // 更新
    if (editorMode === 'project') projects = projects.map(x => x.id === editId ? payload : x);
    else if (editorMode === 'learning') learning = learning.map(x => x.id === editId ? payload : x);
    else life = life.map(x => x.id === editId ? payload : x);
    delete document.getElementById('edSubmit').dataset.editId;
  } else {
    // 新建
    if (editorMode === 'project') projects.unshift(payload);
    else if (editorMode === 'learning') learning.unshift(payload);
    else life.unshift(payload);
  }

  LS.set('projects', projects);
  LS.set('learning', learning);
  LS.set('life', life);

  // 尝试云端同步
  if (!isOffline && sb) {
    try {
      const table = editorMode === 'project' ? 'projects' : editorMode === 'learning' ? 'learning' : 'life';
      await withTimeout(sb.from(table).upsert(payload), 5000);
    } catch(e) { console.log('sync failed', e); }
  } else {
    showToast('<b>✓ 已保存到本地</b> 联网后将自动同步');
  }

  closeEditor();
  showToast(editId ? '更新成功' : '发布成功');
  renderHome();
  if (editorMode === 'project') renderProjects();
  if (editorMode === 'learning') renderLearning();
  if (editorMode === 'life') renderLife();
}

/* 删除 */
function delPost(type, id) {
  if (!confirm('确定删除这条内容吗？')) return;
  if (type === 'project') projects = projects.filter(x => x.id !== id);
  else if (type === 'learning') learning = learning.filter(x => x.id !== id);
  else life = life.filter(x => x.id !== id);
  LS.set('projects', projects);
  LS.set('learning', learning);
  LS.set('life', life);
  showToast('已删除');
  renderHome();
  if (type === 'project') renderProjects();
  if (type === 'learning') renderLearning();
  if (type === 'life') renderLife();
}

/* ===== 图片灯箱 ===== */
function openLightbox(src) { document.getElementById('lbImg').src = src; document.getElementById('lightbox').classList.add('on'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('on'); }

/* ===== 证书墙（示例数据） ===== */
const certs = [
  { name: 'CDA 数据分析师', org: 'CDA  Institute', img: 'cert1.jpg' },
  { name: 'Google Analytics', org: 'Google', img: 'cert2.jpg' },
  { name: '阿里云 ACP', org: 'Alibaba Cloud', img: 'cert3.jpg' }
];
function renderCerts() {
  document.getElementById('certGrid').innerHTML = certs.map(c => `
    <div class="cert" onclick="openLightbox('${esc(c.img)}')">
      <div class="thumb"><img src="${esc(c.img)}" alt="${esc(c.name)}" onerror="this.parentElement.innerHTML='<div style=\'font-size:40px;color:var(--ink-3)\'>📜</div>'"><div class="zoom"><i class="fas fa-search-plus"></i> 查看</div></div>
      <div class="cn">${esc(c.name)}<small>${esc(c.org)}</small></div>
    </div>
  `).join('');
}

/* ===== 键盘快捷键 ===== */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEditor(); closeLightbox(); closeQr(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && document.getElementById('editorOverlay').classList.contains('on')) { e.preventDefault(); edSubmit(); }
});

/* ===== 初始化 ===== */
document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('footYear').textContent = new Date().getFullYear();
renderCerts();
renderHome();

// 尝试从云端加载
async function loadCloud() {
  if (!sb || isOffline) return;
  try {
    const [p, l, f] = await Promise.all([
      withTimeout(sb.from('projects').select('*'), 4000),
      withTimeout(sb.from('learning').select('*'), 4000),
      withTimeout(sb.from('life').select('*'), 4000)
    ]);
    if (p.data && p.data.length) { projects = p.data; LS.set('projects', projects); }
    if (l.data && l.data.length) { learning = l.data; LS.set('learning', learning); }
    if (f.data && f.data.length) { life = f.data; LS.set('life', life); }
    renderHome();
  } catch(e) { console.log('cloud load failed', e); }
}
loadCloud();

// 页面加载后根据hash显示视图
const hash = location.hash.replace('#','') || 'home';
showView(hash);
