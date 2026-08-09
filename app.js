// ============================================================
// js/app.js - 前台所有逻辑
// 数据加载、Store、Realtime、UI 渲染
// ============================================================

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TABLES,
  getSupabaseClient,
  relativeTime,
  showToast,
  escapeHtml,
  getProjectExcerpt
} from './config.js';

// ============================================================
// 1. 数据层（直接操作 Supabase）
// ============================================================
const sb = getSupabaseClient();

// 学习
async function fetchLearning(onlyPublished = true) {
  let q = sb.from(TABLES.LEARNING).select('*').order('created_at', { ascending: false });
  if (onlyPublished) q = q.eq('status', 'published');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// 随笔
async function fetchEssays(onlyPublished = true) {
  let q = sb.from(TABLES.ESSAYS).select('*').order('created_at', { ascending: false });
  if (onlyPublished) q = q.eq('is_published', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// 项目
async function fetchProjects(onlyPublished = true) {
  let q = sb.from(TABLES.PROJECTS).select('*').order('created_at', { ascending: false });
  if (onlyPublished) q = q.eq('status', 'published');
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ============================================================
// 2. Store（全局状态）
// ============================================================
const store = {
  learning: [],
  essays: [],
  projects: [],
  _listeners: []
};

store.subscribe = function(fn) {
  this._listeners.push(fn);
};

store.notify = function() {
  this._listeners.forEach(fn => fn(this.learning, this.essays, this.projects));
};

// ============================================================
// 3. Realtime 管理
// ============================================================
let realtimeChannels = {};

function setupRealtime() {
  const tables = [TABLES.LEARNING, TABLES.ESSAYS, TABLES.PROJECTS];

  tables.forEach(table => {
    if (realtimeChannels[table]) {
      realtimeChannels[table].unsubscribe();
    }

    const channel = sb.channel(`app-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, async (payload) => {
        // 重新加载对应数据
        try {
          if (table === TABLES.LEARNING) {
            store.learning = await fetchLearning(true);
          } else if (table === TABLES.ESSAYS) {
            store.essays = await fetchEssays(true);
          } else if (table === TABLES.PROJECTS) {
            store.projects = await fetchProjects(true);
          }
          store.notify();
          // 如果当前在对应视图，重新渲染
          const viewMap = { learning: 'learning', essays: 'life', projects: 'projects' };
          const view = viewMap[table];
          if (view && currentView === view) renderView(view);
          if (currentView === 'home') renderHome();
        } catch (e) {
          console.warn('[Realtime] 刷新失败:', e);
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Realtime] ${table} 重连...`);
          setTimeout(() => setupRealtime(), 5000);
        }
      });

    realtimeChannels[table] = channel;
  });
}

// ============================================================
// 4. 渲染函数
// ============================================================

// ----- 首页 -----
function renderHome() {
  const container = document.getElementById('homeContent');
  if (!container) return;

  const learning = store.learning.slice(0, 3);
  const projects = store.projects.slice(0, 2);

  let html = `
    <section class="hero">
      <h1>👋 你好，我是阿历</h1>
      <p class="hero-sub">从市场运营到数据驱动 · 用 SQL 和 Python 解答业务问题</p>
      <p class="hero-desc">记录我的数据分析学习与实践，分享项目案例与思考。</p>
    </section>
    <section class="section">
      <h2 class="section-title">📖 最新学习</h2>
      <div class="post-list">
  `;
  if (learning.length === 0) {
    html += `<p class="empty-state">还没有学习笔记。</p>`;
  } else {
    learning.forEach(item => {
      html += `<div class="post-item"><span class="post-title">${escapeHtml(item.title)}</span><span class="post-meta">${relativeTime(item.created_at)}</span></div>`;
    });
  }
  html += `</div></section><section class="section"><h2 class="section-title">🚀 精选项目</h2><div class="projects-grid">`;
  if (projects.length === 0) {
    html += `<p class="empty-state">暂无项目。</p>`;
  } else {
    projects.forEach(item => {
      const cover = item.cover_image ? `<img src="${item.cover_image}" alt="${escapeHtml(item.title)}" loading="lazy" />` : '';
      html += `
        <div class="project-card">
          <div class="project-cover">${cover}</div>
          <div class="project-info">
            <h3 class="project-title">${escapeHtml(item.title)}</h3>
            <p class="project-excerpt">${escapeHtml(getProjectExcerpt(item.description, 120))}</p>
          </div>
        </div>
      `;
    });
  }
  html += `</div></section><section class="section"><h2 class="section-title">📌 关于我</h2>
    <p>我曾从事市场运营，现在专注于数据分析。</p>
    <p><strong>学习路径：</strong> Excel → SQL → Power BI → Python → 机器学习</p>
    <p><a href="#about" class="link-more">了解更多 →</a></p>
  </section>`;
  container.innerHTML = html;
}

// ----- 关于 -----
function renderAbout() {
  const container = document.getElementById('aboutContent');
  if (!container) return;
  container.innerHTML = `
    <article class="about-page">
      <h1>关于我</h1>
      <section class="about-section"><h2>我的转型故事</h2>
        <p>我曾从事市场运营，在与数据打交道的过程中发现数据背后隐藏着业务增长的密码。于是我开始系统学习数据分析，从 Excel 到 SQL，从 Power BI 到 Python，逐步完成转型。</p>
        <p><strong>数据不是冰冷的数字，而是业务最真实的语言。</strong></p>
      </section>
      <section class="about-section"><h2>我的学习路径</h2>
        <div class="skill-path">
          <span class="skill-tag">Excel</span><span class="skill-arrow">→</span>
          <span class="skill-tag">SQL</span><span class="skill-arrow">→</span>
          <span class="skill-tag">Power BI</span><span class="skill-arrow">→</span>
          <span class="skill-tag">Python</span><span class="skill-arrow">→</span>
          <span class="skill-tag">机器学习</span>
        </div>
      </section>
      <section class="about-section"><h2>我正在做的事</h2>
        <ul><li>📊 搭建 RFM 用户分层分析看板</li><li>📈 复购归因与留存分析实战</li><li>🧪 A/B 测试设计与效果评估</li><li>📝 持续输出数据分析学习笔记</li></ul>
      </section>
    </article>
  `;
}

// ----- 学习列表 -----
function renderLearning() {
  const container = document.getElementById('learningContent');
  if (!container) return;
  const items = store.learning;
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">还没有学习笔记。</p>`;
    return;
  }
  let html = `<div class="post-list">`;
  items.forEach(item => {
    const preview = (item.content || '').replace(/[#*`\[\]]/g, '').slice(0, 150);
    html += `
      <div class="post-item">
        <div class="post-item-main">
          <span class="post-title">${escapeHtml(item.title)}</span>
          <span class="post-preview">${escapeHtml(preview)}...</span>
        </div>
        <span class="post-meta">${relativeTime(item.created_at)}</span>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ----- 生活随笔 -----
function renderLife() {
  const container = document.getElementById('lifeContent');
  if (!container) return;
  const items = store.essays;
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">还没有生活随笔。</p>`;
    return;
  }
  let html = `<div class="life-list">`;
  items.forEach(item => {
    const preview = (item.content || '').replace(/[#*`\[\]]/g, '').slice(0, 120);
    const images = (item.images || []).slice(0, 3);
    const imgHtml = images.length ? `<div class="life-images">${images.map(img => `<img src="${img}" loading="lazy" />`).join('')}</div>` : '';
    html += `
      <div class="life-item">
        <div class="life-item-content"><p class="life-text">${escapeHtml(preview)}...</p>${imgHtml}</div>
        <div class="life-item-meta"><span class="life-time">${relativeTime(item.created_at)}</span></div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ----- 项目列表 -----
function renderProjects() {
  const container = document.getElementById('projectsContent');
  if (!container) return;
  const items = store.projects;
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">暂无项目。</p>`;
    return;
  }
  let html = `<div class="projects-grid">`;
  items.forEach(item => {
    const cover = item.cover_image ? `<img src="${item.cover_image}" alt="${escapeHtml(item.title)}" loading="lazy" />` : '';
    const tags = (item.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    html += `
      <div class="project-card">
        <div class="project-cover">${cover}</div>
        <div class="project-info">
          <h3 class="project-title">${escapeHtml(item.title)}</h3>
          <p class="project-excerpt">${escapeHtml(getProjectExcerpt(item.description, 120))}</p>
          <div class="project-tags">${tags}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// ============================================================
// 5. 路由
// ============================================================
let currentView = 'home';
const viewMap = {
  home: renderHome,
  about: renderAbout,
  learning: renderLearning,
  life: renderLife,
  projects: renderProjects
};

function renderView(view) {
  if (viewMap[view]) viewMap[view]();
}

function navigate(view) {
  currentView = view;
  // 隐藏所有视图
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  // 导航高亮
  document.querySelectorAll('.sidebar-nav a, .nav-menu a').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });
  // 渲染
  renderView(view);
  if (window.location.hash !== `#${view}`) {
    history.pushState(null, '', `#${view}`);
  }
}

// ============================================================
// 6. 初始化
// ============================================================
async function initApp() {
  // 主题
  const html = document.documentElement;
  const theme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', theme);
  document.querySelectorAll('#themeToggle, #themeToggleDesktop').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  });

  // 加载数据
  try {
    const [learning, essays, projects] = await Promise.all([
      fetchLearning(true), fetchEssays(true), fetchProjects(true)
    ]);
    store.learning = learning;
    store.essays = essays;
    store.projects = projects;
  } catch (e) {
    showToast('数据加载失败', 'error');
    console.error(e);
  }

  // Store 订阅：数据变化时重绘当前视图
  store.subscribe(() => {
    if (currentView === 'home') renderHome();
    else renderView(currentView);
  });

  // Realtime
  setupRealtime();

  // 导航点击
  document.querySelectorAll('.sidebar-nav a, .nav-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) navigate(view);
    });
  });

  // Hash 变化
  window.addEventListener('hashchange', () => {
    const view = window.location.hash.replace('#', '') || 'home';
    if (viewMap[view]) navigate(view);
  });

  // 移动端菜单
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('navMenu');
  if (hamburger && menu) {
    hamburger.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => menu.classList.remove('open'));
    });
  }

  // 初始导航
  const hash = window.location.hash.replace('#', '') || 'home';
  navigate(hashMap[hash] ? hash : 'home');
}

// 启动
if (document.readyState === 'complete') initApp();
else window.addEventListener('load', initApp);
