/* ========================================
   阿历的数字花园 — 全功能脚本（Supabase 驱动）
   参考 Santiago Diaz 风格 + AI 助手
   ======================================== */

const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentPage = 'home';
let currentAdminTab = 'posts';
let editingId = null;
let quillEditor = null;
let allPosts = [];
let allProjects = [];
let allCertificates = [];
let aiContext = [];

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ===== 工具函数 =====
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 导航 =====
function navigate(page) {
  $$('.page-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === page));
  currentPage = page;
  document.getElementById('navLinks')?.classList.remove('open');
  document.getElementById('mobileMenuBtn')?.classList.remove('active');
  if (page === 'admin') { loadAdminData(); showAdminTab(currentAdminTab); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 数据加载 =====
async function loadPosts(category = null) {
  let query = supabase.from('posts').select('*').eq('status', 'published');
  if (category) query = query.eq('category', category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('加载文章失败:', error); return []; }
  return data || [];
}

async function loadProjects() {
  const { data, error } = await supabase.from('projects').select('*').order('sort_order', { ascending: true });
  if (error) { console.error('加载项目失败:', error); return []; }
  return data || [];
}

async function loadCertificates() {
  const { data, error } = await supabase.from('certificates').select('*').order('sort_order', { ascending: true });
  if (error) { console.error('加载证书失败:', error); return []; }
  return data || [];
}

// ===== 渲染首页 =====
async function renderHome() {
  const projects = await loadProjects();
  const posts = await loadPosts();

  // 项目
  const projectGrid = $('#projectsGrid');
  if (projectGrid) {
    const show = projects.slice(0, 4);
    projectGrid.innerHTML = show.map(p => `
      <article class="project-card" onclick="window.open('${p.demo_link || p.github_link || '#','_blank')}">
        <div class="project-img">${p.cover_image ? `<img src="${p.cover_image}" alt="${p.title}">` : `<div class="project-img-placeholder">📁</div>`}</div>
        <div class="project-body">
          <div class="project-tags">${p.tags ? p.tags.map(t => `<span class="project-tag">${t}</span>`).join('') : ''}</div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-desc">${p.description || ''}</p>
          <div class="project-meta"><span>${formatDate(p.created_at)}</span><span class="project-link">查看详情</span></div>
        </div>
      </article>
    `).join('');
  }

  // 博客
  const blogGrid = $('#blogGrid');
  if (blogGrid) {
    const blogs = posts.filter(p => p.category === 'blog').slice(0, 4);
    blogGrid.innerHTML = blogs.map(b => `
      <article class="blog-card" onclick="viewPost('${b.id}')">
        <div class="blog-meta"><span>${formatDate(b.created_at)}</span><span>${b.tags ? b.tags.slice(0,2).join(' · ') : ''}</span></div>
        <h3 class="blog-title">${b.title}</h3>
        <p class="blog-excerpt">${b.summary || b.content.replace(/<[^>]+>/g,'').slice(0,120)}</p>
        <span class="blog-readmore">阅读全文</span>
      </article>
    `).join('');
  }

  // 笔记
  const notesList = $('#notesList');
  if (notesList) {
    const notes = posts.filter(p => p.category === 'note').slice(0, 5);
    notesList.innerHTML = notes.map(n => `
      <article class="note-item" onclick="viewPost('${n.id}')">
        <span class="note-date">${formatDate(n.created_at)}</span>
        <div class="note-content"><h3 class="note-title">${n.title}</h3><p class="note-desc">${n.summary || n.content.replace(/<[^>]+>/g,'').slice(0,80)}</p></div>
        <div class="note-tags">${(n.tags||[]).map(t => `<span class="note-tag">${t}</span>`).join('')}</div>
      </article>
    `).join('');
  }

  // 生活
  const lifeGrid = $('#lifeGrid');
  if (lifeGrid) {
    const lives = posts.filter(p => p.category === 'life').slice(0, 3);
    lifeGrid.innerHTML = lives.map(l => `
      <article class="life-card" onclick="viewPost('${l.id}')">
        <div class="life-mood">📝</div>
        <p class="life-text">${l.summary || l.content.replace(/<[^>]+>/g,'').slice(0,60)}</p>
        <div class="life-footer"><span>${formatDate(l.created_at)}</span><span>随笔</span></div>
      </article>
    `).join('');
  }

  // 构建 AI 上下文（用于 AI 助手）
  buildAIContext(projects, posts);
}

function buildAIContext(projects, posts) {
  aiContext = [];
  // 项目摘要
  projects.forEach(p => {
    aiContext.push(`项目：${p.title}。描述：${p.description || ''}。标签：${(p.tags||[]).join(', ')}。`);
  });
  // 文章摘要
  posts.slice(0, 20).forEach(p => {
    const clean = p.content.replace(/<[^>]+>/g,'').slice(0,200);
    aiContext.push(`[${p.category}] ${p.title}：${clean}...`);
  });
}

function viewPost(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  alert(`标题：${post.title}\n\n内容：${post.content.replace(/<[^>]+>/g,'').slice(0,300)}...\n\n完整内容请到管理后台查看。`);
}

// ===== 展开更多 =====
async function toggleSection(type) {
  const moreEl = $(`#${type}More`);
  const btnEl = $(`#${type}Toggle`);
  if (!moreEl || !btnEl) return;
  const isOpen = moreEl.classList.contains('open');
  if (isOpen) {
    moreEl.classList.remove('open');
    btnEl.textContent = '查看全部 →';
    const section = $(`#page-${type}`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    let items = [];
    if (type === 'projects') items = await loadProjects();
    else {
      const posts = await loadPosts();
      const map = { notes: 'note', blog: 'blog', life: 'life' };
      items = posts.filter(p => p.category === map[type]);
    }
    if (items.length === 0) { btnEl.textContent = '暂无更多'; return; }
    let html = '';
    if (type === 'projects') {
      html = `<div class="projects-grid">${items.map(p => `
        <article class="project-card" onclick="window.open('${p.demo_link || p.github_link || '#','_blank')}">
          <div class="project-img">${p.cover_image ? `<img src="${p.cover_image}" alt="${p.title}">` : `<div class="project-img-placeholder">📁</div>`}</div>
          <div class="project-body">
            <div class="project-tags">${p.tags ? p.tags.map(t => `<span class="project-tag">${t}</span>`).join('') : ''}</div>
            <h3 class="project-title">${p.title}</h3>
            <p class="project-desc">${p.description || ''}</p>
            <div class="project-meta"><span>${formatDate(p.created_at)}</span><span class="project-link">查看详情</span></div>
          </div>
        </article>
      `).join('')}</div>`;
    } else {
      const listClass = type === 'notes' ? 'notes-list' : (type === 'blog' ? 'blog-grid' : 'life-grid');
      html = `<div class="${listClass}">${items.map(item => {
        if (type === 'notes') {
          return `<article class="note-item" onclick="viewPost('${item.id}')">
            <span class="note-date">${formatDate(item.created_at)}</span>
            <div class="note-content"><h3 class="note-title">${item.title}</h3><p class="note-desc">${item.summary || item.content.replace(/<[^>]+>/g,'').slice(0,80)}</p></div>
            <div class="note-tags">${(item.tags||[]).map(t => `<span class="note-tag">${t}</span>`).join('')}</div>
          </article>`;
        } else if (type === 'blog') {
          return `<article class="blog-card" onclick="viewPost('${item.id}')">
            <div class="blog-meta"><span>${formatDate(item.created_at)}</span></div>
            <h3 class="blog-title">${item.title}</h3>
            <p class="blog-excerpt">${item.summary || item.content.replace(/<[^>]+>/g,'').slice(0,120)}</p>
            <span class="blog-readmore">阅读全文</span>
          </article>`;
        } else if (type === 'life') {
          return `<article class="life-card" onclick="viewPost('${item.id}')">
            <div class="life-mood">📝</div>
            <p class="life-text">${item.summary || item.content.replace(/<[^>]+>/g,'').slice(0,60)}</p>
            <div class="life-footer"><span>${formatDate(item.created_at)}</span></div>
          </article>`;
        }
      }).join('')}</div>`;
    }
    moreEl.innerHTML = html;
    moreEl.classList.add('open');
    btnEl.textContent = '收起 ↑';
  }
}

// ===== AI 助手 =====
function openAIChat() {
  document.getElementById('aiOverlay').style.display = 'flex';
  document.getElementById('aiInput').focus();
}

function closeAIChat() {
  document.getElementById('aiOverlay').style.display = 'none';
}

function sendAIMessage() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const container = document.getElementById('aiMessages');
  // 用户消息
  const userDiv = document.createElement('div');
  userDiv.className = 'ai-message ai-user';
  userDiv.textContent = msg;
  container.appendChild(userDiv);

  // 显示"正在思考..."
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'ai-message ai-bot';
  thinkingDiv.textContent = '🤔 思考中...';
  container.appendChild(thinkingDiv);
  container.scrollTop = container.scrollHeight;

  // 模拟 AI 回复（基于上下文）
  setTimeout(() => {
    const reply = generateAIReply(msg);
    thinkingDiv.textContent = reply;
    container.scrollTop = container.scrollHeight;
  }, 500 + Math.random() * 800);
}

function generateAIReply(question) {
  const q = question.toLowerCase();
  // 检查是否匹配项目相关
  if (q.includes('项目') || q.includes('案例') || q.includes('作品')) {
    const projects = allProjects.slice(0, 3);
    if (projects.length === 0) return '目前还没有项目案例。你可以通过管理后台添加。';
    return `我目前有 ${projects.length} 个项目案例：\n${projects.map(p => `• ${p.title}：${p.description || '暂无描述'}`).join('\n')}\n\n点击首页的"项目案例"可以查看全部。`;
  }
  if (q.includes('数据分析') || q.includes('数据') || q.includes('分析')) {
    return '我擅长快消品与电商领域的数据分析，包括：\n• 库存健康度诊断与智能补货\n• RFM 用户分层与精细化运营\n• 复购归因与 A/B 测试\n• 用户留存分析与增长策略\n\n你有具体的数据问题吗？我可以帮你分析。';
  }
  if (q.includes('运营') || q.includes('增长') || q.includes('策略')) {
    return '在增长运营方面，我的核心方法论是：\n• 用数据驱动决策，而不是凭感觉\n• 从用户行为中找到增长杠杆\n• 通过 A/B 测试验证假设\n• 建立可复用的运营模型\n\n我曾经帮助一家电商母婴店铺从 0 做到月销 100W+。';
  }
  if (q.includes('你好') || q.includes('hi') || q.includes('hello')) {
    return '你好呀！👋 我是阿历的 AI 助手。你可以问我关于数据分析、运营策略、项目案例等方面的问题。';
  }
  if (q.includes('帮助') || q.includes('能做什么') || q.includes('功能')) {
    return '我可以帮你：\n• 了解阿历的项目案例和经验\n• 回答数据分析相关问题\n• 介绍运营策略和方法论\n• 提供职业成长建议\n\n你也可以直接浏览网站的各个板块了解更多。';
  }
  // 从上下文中查找关键词
  for (const ctx of aiContext) {
    if (ctx.includes(q.slice(0, 4)) || q.split(' ').some(w => w.length > 1 && ctx.includes(w))) {
      return `根据我的知识库，我找到相关信息：\n${ctx.slice(0, 300)}...\n\n需要更详细的解答吗？你可以访问对应板块查看完整内容。`;
    }
  }
  return `关于「${question}」这个问题，我暂时没有找到直接相关的信息。\n\n你可以：\n• 浏览网站的「项目案例」「博客」「学习笔记」等板块\n• 换一种方式提问\n• 直接联系阿历本人交流\n\n我还在不断学习中，欢迎多问我！`;
}

// ===== 管理后台 =====
async function loadAdminData() {
  const { data: posts } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  allPosts = posts || [];
  allProjects = await loadProjects();
  allCertificates = await loadCertificates();
  renderAdminList(currentAdminTab);
}

function showAdminTab(tab) {
  currentAdminTab = tab;
  $$('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.admin-list').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`admin${tab.charAt(0).toUpperCase()+tab.slice(1)}List`);
  if (target) target.style.display = 'flex';
  renderAdminList(tab);
}

function renderAdminList(tab) {
  const container = document.getElementById(`admin${tab.charAt(0).toUpperCase()+tab.slice(1)}List`);
  if (!container) return;
  let items = [];
  if (tab === 'posts') items = allPosts;
  else if (tab === 'projects') items = allProjects;
  else if (tab === 'certificates') items = allCertificates;
  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:20px;">暂无数据，点击"新建"添加。</p>';
    return;
  }
  container.innerHTML = items.map(item => {
    const title = item.title || item.name || '未命名';
    const meta = tab === 'posts' ? `分类: ${item.category} | ${formatDate(item.created_at)}` :
                 tab === 'projects' ? `更新: ${formatDate(item.updated_at)}` :
                 `颁发: ${item.issue_date || ''}`;
    return `
      <div class="admin-item">
        <div class="admin-item-info"><div class="admin-item-title">${title}</div><div class="admin-item-meta">${meta}</div></div>
        <div class="admin-item-actions">
          <button class="edit-btn" onclick="editAdminItem('${tab}','${item.id}')">编辑</button>
          <button class="delete-btn" onclick="deleteAdminItem('${tab}','${item.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function editAdminItem(tab, id) {
  let item = null;
  if (tab === 'posts') item = allPosts.find(p => p.id === id);
  else if (tab === 'projects') item = allProjects.find(p => p.id === id);
  else if (tab === 'certificates') item = allCertificates.find(p => p.id === id);
  if (!item) return;
  editingId = id;
  const form = $('#adminForm');
  form.style.display = 'block';
  document.getElementById('adminFormTitle').textContent = `编辑 ${tab === 'posts' ? '文章' : tab === 'projects' ? '项目' : '证书'}`;
  if (tab === 'posts') {
    document.getElementById('formId').value = item.id;
    document.getElementById('formTitle').value = item.title || '';
    document.getElementById('formCategory').value = item.category || 'blog';
    document.getElementById('formSummary').value = item.summary || '';
    document.getElementById('formCover').value = item.cover_image || '';
    document.getElementById('formTags').value = (item.tags || []).join(', ');
    document.getElementById('formStatus').value = item.status || 'published';
    if (quillEditor) quillEditor.root.innerHTML = item.content || '';
  }
  $('#adminFormElement').dataset.tab = tab;
}

async function deleteAdminItem(tab, id) {
  if (!confirm('确定要删除吗？')) return;
  let table = tab === 'posts' ? 'posts' : tab === 'projects' ? 'projects' : 'certificates';
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) { alert('删除失败: ' + error.message); return; }
  alert('删除成功');
  loadAdminData();
}

async function handleAdminSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const tab = form.dataset.tab || 'posts';
  const id = document.getElementById('formId').value;
  const title = document.getElementById('formTitle').value;
  const category = document.getElementById('formCategory').value;
  const summary = document.getElementById('formSummary').value;
  const cover = document.getElementById('formCover').value;
  const tags = document.getElementById('formTags').value.split(',').map(s => s.trim()).filter(Boolean);
  const status = document.getElementById('formStatus').value;
  const content = quillEditor ? quillEditor.root.innerHTML : '';
  const data = { title, summary, cover_image: cover, tags, status, content, updated_at: new Date().toISOString() };
  if (tab === 'posts') data.category = category;
  let result;
  if (id) {
    result = await supabase.from(tab === 'posts' ? 'posts' : tab === 'projects' ? 'projects' : 'certificates')
      .update(data).eq('id', id);
  } else {
    data.created_at = new Date().toISOString();
    result = await supabase.from(tab === 'posts' ? 'posts' : tab === 'projects' ? 'projects' : 'certificates')
      .insert([data]);
  }
  if (result.error) { alert('保存失败: ' + result.error.message); return; }
  alert('保存成功');
  resetForm();
  loadAdminData();
  renderHome();
}

function resetForm() {
  document.getElementById('adminForm').style.display = 'none';
  document.getElementById('adminFormElement').reset();
  document.getElementById('formId').value = '';
  editingId = null;
  if (quillEditor) quillEditor.root.innerHTML = '';
}

// ===== 初始化 =====
async function init() {
  quillEditor = new Quill('#editorContainer', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold','italic','underline','strike'],
        ['blockquote','code-block'],
        [{ header: 1 }, { header: 2 }],
        [{ list: 'ordered'}, { list: 'bullet' }],
        [{ script: 'sub'}, { script: 'super' }],
        [{ indent: '-1'}, { indent: '+1' }],
        [{ size: ['small', false, 'large', 'huge'] }],
        [{ header: [1,2,3,4,5,6,false] }],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ align: [] }],
        ['clean'],
        ['link','image','video']
      ]
    }
  });

  quillEditor.getModule('toolbar').addHandler('image', function() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;
      const { data, error } = await supabase.storage.from('assets').upload(filePath, file);
      if (error) { alert('上传失败: ' + error.message); return; }
      const { publicURL } = supabase.storage.from('assets').getPublicUrl(filePath);
      const range = quillEditor.getSelection();
      quillEditor.insertEmbed(range.index, 'image', publicURL);
    };
  });

  $$('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) navigate(page);
    });
  });

  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      menuBtn.classList.toggle('active');
    });
  }

  $$('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => showAdminTab(tab.dataset.tab));
  });

  document.getElementById('adminNewBtn').addEventListener('click', () => {
    resetForm();
    const form = document.getElementById('adminForm');
    form.style.display = 'block';
    document.getElementById('adminFormTitle').textContent = '新建文章';
    document.getElementById('adminFormElement').dataset.tab = 'posts';
    document.getElementById('formId').value = '';
    document.getElementById('formCategory').value = 'blog';
  });

  document.getElementById('formCancel').addEventListener('click', resetForm);
  document.getElementById('adminFormElement').addEventListener('submit', handleAdminSubmit);

  // 点击 AI 弹窗外部关闭
  document.getElementById('aiOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('aiOverlay')) closeAIChat();
  });

  await renderHome();
  navigate('home');
  initCounters();
  initReveal();
}

// ===== 辅助功能 =====
function showQR(src, label) {
  const modal = document.getElementById('qrModal');
  const img = document.getElementById('qrImg');
  const text = document.getElementById('qrText');
  if (!modal || !img || !text) return;
  img.src = src;
  text.textContent = '扫码添加' + label;
  modal.classList.add('active');
}

function closeQR() {
  const modal = document.getElementById('qrModal');
  if (modal) modal.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('qrModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeQR(); });
});

function initCounters() {
  const counters = document.querySelectorAll('.about-stat-num');
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
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// 将关键函数暴露到全局（供 HTML onclick 调用）
window.toggleSection = toggleSection;
window.viewPost = viewPost;
window.openAIChat = openAIChat;
window.closeAIChat = closeAIChat;
window.sendAIMessage = sendAIMessage;
window.showQR = showQR;
window.closeQR = closeQR;
window.editAdminItem = editAdminItem;
window.deleteAdminItem = deleteAdminItem;
window.navigate = navigate;

document.addEventListener('DOMContentLoaded', init);
