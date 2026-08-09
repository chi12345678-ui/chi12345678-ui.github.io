/* ========================================
   阿历的数字花园 — Supabase 版
   数据存储: Supabase (posts 表)
   文件存储: GitHub 仓库 (项目文件 + 证书)
   ======================================== */

// ========================================
// 配置
// ========================================
const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';

const GITHUB = {
  owner: 'chi12345678-ui',
  repo: 'chi12345678-ui.github.io'
};

// 初始化 Supabase 客户端
const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// 内存缓存
let allPosts = [];
let allFiles = [];
let certFiles = [];

// ========================================
// 1. 主题切换
// ========================================
(function initTheme(){
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);

  $('#themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();

// ========================================
// 2. 从 Supabase 加载文章数据
// ========================================
async function loadPosts() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allPosts = data || [];
    renderPosts();
  } catch (e) {
    console.error('Supabase 加载失败:', e);
    showNoData('notesList', '数据库连接失败，请确认已在 Supabase SQL Editor 执行建表语句');
    showNoData('blogList', '数据库连接失败');
    showNoData('lifeList', '数据库连接失败');
  }
}

function renderPosts() {
  const notes = allPosts.filter(p => p.type === 'note');
  const blogs = allPosts.filter(p => p.type === 'blog');
  const lifes = allPosts.filter(p => p.type === 'life');

  renderContentList('notesList', notes, 'note');
  renderContentList('blogList', blogs, 'blog');
  renderContentList('lifeList', lifes, 'life');
}

function renderContentList(listId, items, type) {
  const list = $('#' + listId);
  if (!list) return;

  if (items.length === 0) {
    const names = { note: '学习笔记', blog: '博客文章', life: '生活随笔' };
    list.innerHTML = `<div class="loading">暂无${names[type]}。点击右上角「+」按钮新建，内容将实时同步到数据库。</div>`;
    return;
  }

  list.innerHTML = items.slice(0, 5).map(item => {
    const date = item.created_at ? item.created_at.slice(0, 10) : '未知日期';
    const desc = item.content ? stripMarkdown(item.content).slice(0, 60) + '...' : '暂无描述';
    const tags = (item.tags || []).slice(0, 2);
    return `
      <article class="content-item" onclick="openArticle(${item.id})">
        <span class="content-date">${date}</span>
        <div class="content-info">
          <h3 class="content-title">${escapeHtml(item.title)}</h3>
          <p class="content-desc">${escapeHtml(desc)}</p>
        </div>
        <div class="content-tags">${tags.map(t=>`<span class="content-tag">${escapeHtml(t)}</span>`).join('')}</div>
      </article>
    `;
  }).join('');
}

// ========================================
// 3. Supabase Realtime 实时订阅
// ========================================
function subscribePosts() {
  supabase
    .channel('posts-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'posts'
    }, (payload) => {
      console.log('Realtime 更新:', payload);
      // 重新加载数据
      loadPosts();
      // 显示提示
      const eventMap = { INSERT: '新文章发布', UPDATE: '文章更新', DELETE: '文章删除' };
      showToast(eventMap[payload.eventType] || '数据已更新');
    })
    .subscribe();
}

// ========================================
// 4. GitHub API — 项目文件 & 证书
// ========================================
async function fetchGitHubFiles() {
  try {
    const [contentsRes, certsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/contents/`).catch(() => null),
      fetch(`https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/contents/certs`).catch(() => null)
    ]);

    if (contentsRes && contentsRes.ok) {
      allFiles = await contentsRes.json();
      renderProjectsFromRepo();
    } else {
      renderDefaultProjects();
    }

    if (certsRes && certsRes.ok) {
      certFiles = await certsRes.json();
      renderCerts();
    } else {
      showNoData('certsGrid', '暂无证书，上传图片到 certs/ 文件夹即可自动展示');
    }
  } catch (e) {
    console.error('GitHub API 错误:', e);
    renderDefaultProjects();
    showNoData('certsGrid', '加载失败');
  }
}

function renderProjectsFromRepo() {
  const grid = $('#projectsGrid');
  if (!grid) return;

  const projectExts = ['.pdf', '.pbix', '.html', '.ipynb'];
  const excludeNames = ['池增历', '简历', 'resume', 'README', 'index', 'style', 'app'];

  let projects = allFiles
    .filter(f => f.type === 'file' && projectExts.some(ext => f.name.toLowerCase().endsWith(ext)))
    .filter(f => !excludeNames.some(ex => f.name.toLowerCase().includes(ex.toLowerCase())))
    .map(f => {
      const name = f.name.replace(/\.[^.]+$/, '');
      const ext = f.name.split('.').pop().toLowerCase();
      const icons = { pdf: '📄', pbix: '📊', html: '🌐', ipynb: '📓' };
      const tags = { pdf: ['报告'], pbix: ['Power BI'], html: ['交互报告'], ipynb: ['Python'] };
      return {
        title: name,
        tags: tags[ext] || ['项目'],
        desc: `项目文件：${f.name}`,
        date: '仓库文件',
        link: f.download_url || f.html_url,
        icon: icons[ext] || '📁'
      };
    });

  if (projects.length === 0) {
    renderDefaultProjects();
    return;
  }

  grid.innerHTML = projects.slice(0, 4).map(p => projectCardHtml(p)).join('');
}

function renderDefaultProjects() {
  const grid = $('#projectsGrid');
  if (!grid) return;
  const defaults = [
    { title: '快消品进销存案例分析报告', tags: ['库存优化','PDF'], desc: '搭建库存健康度诊断体系与智能补货模型，将缺货率降低40%。', date: '2024-06', link: '快消品进销存案例分析报告.pdf', icon: '📄' },
    { title: '复购分析案例', tags: ['RFM','Power BI'], desc: '基于10万+用户交易数据，构建复购归因模型，召回效率提升2倍。', date: '2024-03', link: '复购分析案例.pdf', icon: '📊' },
    { title: '线上平台用户RFM分析', tags: ['用户分层','HTML'], desc: '将10万用户按RFM模型分为8个层级，月销从0增长至100W+。', date: '2023-12', link: '线上平台用户RFM分析.html', icon: '🌐' },
    { title: '复购分析案例', tags: ['Python','Jupyter'], desc: 'Python 代码实现复购分析全流程。', date: '2024-03', link: '复购分析案例.ipynb', icon: '📓' }
  ];
  grid.innerHTML = defaults.map(p => projectCardHtml(p)).join('');
}

function projectCardHtml(p) {
  return `
    <article class="project-card" onclick="window.open('${p.link}','_blank')">
      <div class="project-img">
        <div class="project-img-placeholder">${p.icon}</div>
        <span class="project-img-tag">${p.tags[0]}</span>
      </div>
      <div class="project-body">
        <h3 class="project-title">${p.title}</h3>
        <p class="project-desc">${p.desc}</p>
        <div class="project-meta">
          <div class="project-tags">${p.tags.map(t=>`<span class="project-tag">${t}</span>`).join('')}</div>
          <span class="project-link">查看详情 →</span>
        </div>
      </div>
    </article>
  `;
}

function renderCerts() {
  const grid = $('#certsGrid');
  if (!grid) return;
  const images = certFiles.filter(f =>
    ['.png','.jpg','.jpeg','.gif','.webp'].some(ext => f.name.toLowerCase().endsWith(ext))
  );
  if (images.length === 0) {
    grid.innerHTML = '<div class="loading">暂无证书图片，上传至 certs/ 文件夹即可自动展示</div>';
    return;
  }
  grid.innerHTML = images.map(img => `
    <div class="cert-item" onclick="window.open('${img.download_url}','_blank')">
      <img src="${img.download_url}" alt="${img.name}" loading="lazy">
      <div class="cert-item-name">${img.name.replace(/\.[^.]+$/, '')}</div>
    </div>
  `).join('');
}

// ========================================
// 5. 文章详情页
// ========================================
function openArticle(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) { showToast('文章未找到'); return; }

  const page = $('#pageArticle');
  const content = $('#articleContent');
  const date = post.created_at ? post.created_at.slice(0, 10) : '未知日期';
  const tags = (post.tags || []).join(', ') || '未分类';
  const bodyHtml = markdownToHtml(post.content || '暂无内容');

  content.innerHTML = `
    <h1>${escapeHtml(post.title)}</h1>
    <div class="article-meta">
      <span>📅 ${date}</span>
      <span>🏷️ ${escapeHtml(tags)}</span>
    </div>
    <div class="article-body">${bodyHtml}</div>
  `;

  page.style.display = 'block';
  document.body.style.overflow = 'hidden';
  page.scrollTop = 0;
}

function closeArticle() {
  $('#pageArticle').style.display = 'none';
  document.body.style.overflow = '';
}

// ========================================
// 6. Markdown 编辑器 & 发布到 Supabase
// ========================================
function openEditor(type) {
  const overlay = $('#editorOverlay');
  const title = $('#editorTitle');
  const tagSelect = $('#editorTag');

  const titles = { blog: '写博客文章', note: '写学习笔记', life: '写生活随笔' };
  title.textContent = titles[type] || '写文章';
  tagSelect.value = type;

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditor() {
  $('#editorOverlay').style.display = 'none';
  document.body.style.overflow = '';
  $('#editorPreview').classList.remove('active');
  $('#editorInputTitle').value = '';
  $('#editorTextarea').value = '';
}

function previewArticle() {
  const md = $('#editorTextarea').value;
  const preview = $('#editorPreview');
  preview.innerHTML = markdownToHtml(md);
  preview.classList.toggle('active');
}

async function publishArticle() {
  const title = $('#editorInputTitle').value.trim();
  const content = $('#editorTextarea').value.trim();
  const type = $('#editorTag').value;

  if (!title) { showToast('请输入标题'); return; }
  if (!content) { showToast('请输入内容'); return; }

  showToast('正在发布到 Supabase...');

  try {
    // 从内容中提取标签（#tag 格式）
    const tagMatches = content.match(/#(\w+)/g);
    const tags = tagMatches ? tagMatches.map(t => t.slice(1)) : [];

    const { data, error } = await supabase
      .from('posts')
      .insert([{ title, content, type, tags }])
      .select();

    if (error) throw error;

    showToast('发布成功！');
    closeEditor();
    // Realtime 会自动刷新，但手动刷新更及时
    await loadPosts();
  } catch (e) {
    console.error('发布失败:', e);
    showToast('发布失败: ' + (e.message || '请检查数据库权限'));
  }
}

// ========================================
// 7. AI 聊天
// ========================================
function toggleAIChat() {
  $('#aiChat').classList.toggle('active');
}

function sendAIMsg() {
  const input = $('#aiChatInput');
  const body = $('#aiChatBody');
  const text = input.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg ai-msg-user';
  userMsg.textContent = text;
  body.appendChild(userMsg);

  input.value = '';
  body.scrollTop = body.scrollHeight;

  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg ai-msg-bot';
    const replies = [
      '感谢你的提问！我目前是一个演示助手，你可以后期接入 OpenAI 或 Claude API 来实现真正的智能对话。',
      '关于数据分析，我建议从业务场景出发，先明确问题再选择工具。',
      '我的项目案例都在「项目案例」板块，点击卡片即可查看详细报告和源文件。',
      '如果你想学习数据分析，推荐先从 Excel 和 SQL 入手，再逐步学习 Python 和可视化工具。'
    ];
    botMsg.innerHTML = `<p>${replies[Math.floor(Math.random() * replies.length)]}</p>`;
    body.appendChild(botMsg);
    body.scrollTop = body.scrollHeight;
  }, 800);
}

// ========================================
// 8. 二维码弹窗
// ========================================
function showQR(src, label) {
  $('#qrImg').src = src;
  $('#qrText').textContent = '扫码添加' + label;
  $('#qrModal').classList.add('active');
}
function closeQR() {
  $('#qrModal').classList.remove('active');
}
$('#qrModal').addEventListener('click', (e) => {
  if (e.target === $('#qrModal')) closeQR();
});

// ========================================
// 9. Toast 提示
// ========================================
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showNoData(id, msg) {
  const el = $('#' + id);
  if (el) el.innerHTML = `<div class="loading">${msg}</div>`;
}

// ========================================
// 10. 导航高亮 + 平滑滚动
// ========================================
(function initNav(){
  const sections = $$('section[id]');
  const links = $$('.nav-link');
  const mobileLinks = $$('.mobile-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => l.classList.toggle('active', l.dataset.section === id));
        mobileLinks.forEach(l => l.classList.toggle('active', l.dataset.section === id));
      }
    });
  }, { threshold: 0.2 });

  sections.forEach(s => observer.observe(s));

  [...links, ...mobileLinks].forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        $('#mobileMenu').classList.remove('active');
        $('#mobileMenuBtn').classList.remove('active');
      }
    });
  });
})();

function scrollToSection(id) {
  const el = $('#' + id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ========================================
// 11. 移动端菜单
// ========================================
$('#mobileMenuBtn').addEventListener('click', () => {
  $('#mobileMenu').classList.toggle('active');
  $('#mobileMenuBtn').classList.toggle('active');
});

// ========================================
// 12. 数字计数动画
// ========================================
(function initCounters(){
  const counters = $$('.about-stat-num');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const step = target / 50;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) { current = target; clearInterval(timer); }
          el.textContent = Math.floor(current) + suffix;
        }, 30);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
})();

// ========================================
// 13. 滚动动画
// ========================================
(function initReveal(){
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  const els = $$('.section-header, .section-desc, .project-card, .content-item, .about-card, .about-stat, .cert-item, .hero-text, .hero-photo, .contact-inner');
  els.forEach((el, i) => {
    el.classList.add('reveal', `reveal-d${(i % 3) + 1}`);
    observer.observe(el);
  });
})();

// ========================================
// 14. 顶部导航滚动效果
// ========================================
window.addEventListener('scroll', () => {
  const nav = $('#topnav');
  nav.style.boxShadow = window.pageYOffset > 100 ? '0 1px 10px rgba(0,0,0,0.05)' : 'none';
});

// ========================================
// 15. 工具函数
// ========================================
function markdownToHtml(md) {
  if (!md) return '<p>暂无内容</p>';
  let html = escapeHtml(md)
    .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = '<p>' + html + '</p>';
  html = html.replace(/<p><(h[1-6]|blockquote|li)/g, '<$1');
  html = html.replace(/<\/(h[1-6]|blockquote|li)><\/p>/g, '</$1>');
  html = html.replace(/<p><\/p>/g, '');
  // 包裹连续的 li
  html = html.replace(/(<li>.*?<\/li>)(?=<li>|$)/gs, '<ul>$1</ul>');
  return html;
}

function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/[#*_`\[\]!]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/https?:\/\/\S+/g, '链接')
    .replace(/\n/g, ' ')
    .slice(0, 100);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// 16. 初始化
// ========================================
(async function init() {
  await Promise.all([
    loadPosts(),
    fetchGitHubFiles()
  ]);
  subscribePosts();
})();

console.log('%c🌱 阿历的数字花园已加载', 'color:#7c3aed;font-size:14px;font-weight:bold;');
console.log('%c数据存储: Supabase | 文件存储: GitHub', 'color:#8a8a9a;font-size:12px;');
