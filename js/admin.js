// ============================================================
// js/admin.js - 后台所有逻辑
// 登录、编辑器、CRUD
// ============================================================

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  TABLES,
  getSupabaseClient,
  showToast,
  escapeHtml,
  getProjectExcerpt,
  relativeTime
} from './config.js';

const sb = getSupabaseClient();

// ============================================================
// 1. 数据 CRUD
// ============================================================
async function fetchAll(table, filters = {}) {
  let q = sb.from(table).select('*').order('created_at', { ascending: false });
  Object.entries(filters).forEach(([k, v]) => q = q.eq(k, v));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function createRecord(table, record) {
  const { data, error } = await sb.from(table).insert(record).select().single();
  if (error) throw error;
  return data;
}

async function updateRecord(table, id, updates) {
  const { data, error } = await sb.from(table).update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteRecord(table, id) {
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================
// 2. 认证
// ============================================================
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.user || null;
}

async function doLogin(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function doLogout() {
  await sb.auth.signOut();
}

// ============================================================
// 3. 编辑器 (EasyMDE)
// ============================================================
let easyMDE = null;
let editState = { table: null, id: null, isNew: true };

function openEditor(table, data = null) {
  const modal = document.getElementById('editorModal');
  const titleInput = document.getElementById('editorTitleInput');
  const textarea = document.getElementById('editorMarkdown');
  const publishedCheck = document.getElementById('editorPublished');
  const statusText = document.getElementById('editorStatusText');
  const editorTitle = document.getElementById('editorTitle');

  editState.table = table;
  editState.isNew = !data;
  editState.id = data?.id || null;

  // 随笔隐藏标题
  const titleWrap = titleInput.closest('.form-group');
  if (table === 'essays') {
    titleWrap.style.display = 'none';
  } else {
    titleWrap.style.display = 'block';
  }

  if (data) {
    editorTitle.textContent = `编辑 ${table === 'learning' ? '学习笔记' : table === 'essays' ? '随笔' : '项目'}`;
    titleInput.value = data.title || '';
    textarea.value = data.content || data.description || '';
    if (table === 'learning' || table === 'projects') {
      publishedCheck.checked = data.status === 'published';
      statusText.textContent = data.status === 'published' ? '发布' : '草稿';
    } else {
      publishedCheck.checked = data.is_published === true;
      statusText.textContent = data.is_published ? '发布' : '草稿';
    }
  } else {
    editorTitle.textContent = `新建 ${table === 'learning' ? '学习笔记' : table === 'essays' ? '随笔' : '项目'}`;
    titleInput.value = '';
    textarea.value = '';
    publishedCheck.checked = false;
    statusText.textContent = '草稿';
  }

  // 初始化 EasyMDE
  if (easyMDE) { easyMDE.toTextArea(); easyMDE = null; }
  if (typeof EasyMDE === 'undefined') {
    showToast('编辑器加载失败', 'error');
    return;
  }
  easyMDE = new EasyMDE({
    element: textarea,
    spellChecker: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'code', 'code-block', '|', 'preview', 'side-by-side', 'fullscreen'],
    renderingConfig: { codeSyntaxHighlighting: true, hljs: window.hljs }
  });

  publishedCheck.onchange = () => {
    statusText.textContent = publishedCheck.checked ? '发布' : '草稿';
  };

  modal.style.display = 'flex';
  setTimeout(() => easyMDE?.codemirror?.focus(), 100);
}

function closeEditor() {
  document.getElementById('editorModal').style.display = 'none';
  if (easyMDE) { easyMDE.toTextArea(); easyMDE = null; }
}

async function saveRecord() {
  if (!easyMDE) { showToast('编辑器未初始化', 'error'); return; }

  const titleInput = document.getElementById('editorTitleInput');
  const publishedCheck = document.getElementById('editorPublished');
  const { table, id, isNew } = editState;

  const title = titleInput.value.trim();
  const content = easyMDE.value();
  const isPublished = publishedCheck.checked;

  if (table !== 'essays' && !title) { showToast('请输入标题', 'error'); return; }
  if (!content) { showToast('请输入内容', 'error'); return; }

  try {
    let record;
    if (table === 'learning') {
      record = { title, content, status: isPublished ? 'published' : 'draft' };
      if (isNew) await createRecord(TABLES.LEARNING, record);
      else await updateRecord(TABLES.LEARNING, id, record);
    } else if (table === 'essays') {
      record = { content, is_published: isPublished };
      if (isNew) await createRecord(TABLES.ESSAYS, record);
      else await updateRecord(TABLES.ESSAYS, id, record);
    } else if (table === 'projects') {
      record = { title, description: content, status: isPublished ? 'published' : 'draft' };
      if (isNew) await createRecord(TABLES.PROJECTS, record);
      else await updateRecord(TABLES.PROJECTS, id, record);
    }
    showToast(isNew ? '创建成功' : '更新成功', 'success');
    closeEditor();
    loadAdminData();
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function deleteItem(table, id) {
  try {
    await deleteRecord(table, id);
    showToast('删除成功', 'success');
    loadAdminData();
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

// ============================================================
// 4. 图片上传
// ============================================================
async function uploadImage(file) {
  try {
    const compressed = await compressImage(file);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
    const { error } = await sb.storage.from('learning-images').upload(fileName, compressed, {
      contentType: file.type, cacheControl: '3600'
    });
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('learning-images').getPublicUrl(fileName);
    if (easyMDE) {
      const cm = easyMDE.codemirror;
      const doc = cm.getDoc();
      const cursor = doc.getCursor();
      doc.replaceRange(`![${file.name}](${publicUrl})`, cursor);
    }
    showToast('图片上传成功', 'success');
  } catch (e) {
    showToast('上传失败: ' + e.message, 'error');
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const max = 1200;
        if (w > max || h > max) { const r = Math.min(max/w, max/h); w *= r; h *= r; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => resolve(b), file.type, 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// 5. 后台渲染
// ============================================================
let adminData = { learning: [], essays: [], projects: [] };
let currentAdminView = 'learning';

async function loadAdminData() {
  try {
    const [learning, essays, projects] = await Promise.all([
      fetchAll(TABLES.LEARNING),
      fetchAll(TABLES.ESSAYS),
      fetchAll(TABLES.PROJECTS)
    ]);
    adminData = { learning, essays, projects };
    renderAdminView(currentAdminView);
  } catch (e) {
    showToast('加载数据失败', 'error');
  }
}

function renderAdminView(view) {
  const container = document.getElementById(`${view}Content`);
  if (!container) return;

  if (view === 'home') {
    container.innerHTML = `<h2>首页预览</h2><p>这里显示已发布内容的预览。</p>`;
    return;
  }

  const items = adminData[view] || [];
  const tableMap = { learning: TABLES.LEARNING, essays: TABLES.ESSAYS, projects: TABLES.PROJECTS };
  const table = tableMap[view];
  const nameMap = { learning: '学习笔记', essays: '随笔', projects: '项目' };

  let html = `
    <div class="admin-toolbar">
      <button class="btn btn-primary" id="newBtn"><i class="fas fa-plus"></i> 新建${nameMap[view]}</button>
      <span class="admin-stats">共 ${items.length} 条</span>
    </div>
  `;

  if (items.length === 0) {
    html += `<p class="empty-state">暂无数据</p>`;
  } else if (view === 'projects') {
    html += `<div class="projects-grid">`;
    items.forEach(item => {
      const cover = item.cover_image ? `<img src="${item.cover_image}" loading="lazy" />` : '';
      const status = item.status === 'published' ? '已发布' : '草稿';
      const statusCls = item.status === 'published' ? 'status-published' : 'status-draft';
      html += `
        <div class="project-card">
          <div class="project-cover">${cover}</div>
          <div class="project-info">
            <h3 class="project-title">${escapeHtml(item.title)}</h3>
            <p class="project-excerpt">${escapeHtml(getProjectExcerpt(item.description, 100))}</p>
            <div class="project-admin-actions">
              <span class="project-status ${statusCls}">${status}</span>
              <button class="btn btn-sm btn-outline edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `<div class="post-list">`;
    items.forEach(item => {
      const title = view === 'essays' ? (item.content || '').slice(0, 30) + '...' : (item.title || '无标题');
      const status = view === 'essays'
        ? (item.is_published ? '已发布' : '草稿')
        : (item.status === 'published' ? '已发布' : '草稿');
      const statusCls = status === '已发布' ? 'status-published' : 'status-draft';
      html += `
        <div class="post-item">
          <span class="post-title">${escapeHtml(title)}</span>
          <span class="post-status ${statusCls}">${status}</span>
          <span class="post-meta">${relativeTime(item.created_at)}</span>
          <div class="post-actions">
            <button class="btn btn-sm btn-outline edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;

  // 绑定事件
  const newBtn = container.querySelector('#newBtn');
  if (newBtn) newBtn.onclick = () => openEditor(view);

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const item = adminData[view].find(i => i.id === id);
      if (item) openEditor(view, item);
    };
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => {
      if (confirm('确定删除吗？')) deleteItem(table, btn.dataset.id);
    };
  });
}

function navigateAdmin(view) {
  currentAdminView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sidebar-nav a, .nav-menu a').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });
  renderAdminView(view);
}

// ============================================================
// 6. 初始化后台
// ============================================================
async function initAdmin() {
  // 主题
  const html = document.documentElement;
  const theme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', theme);
  document.querySelectorAll('#themeToggle, #themeToggleDesktop').forEach(btn => {
    btn.onclick = () => {
      const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    };
  });

  // 登录
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      await doLogin(email, password);
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('adminUser').textContent = email;
      document.getElementById('adminUserSidebar').textContent = email;
      showToast('登录成功', 'success');
      await loadAdminData();
      navigateAdmin('learning');
    } catch (err) {
      document.getElementById('loginError').textContent = err.message;
      document.getElementById('loginError').style.display = 'block';
    }
  };

  // 登出
  document.querySelectorAll('#logoutBtn, #logoutBtnSidebar').forEach(btn => {
    btn.onclick = async () => {
      await doLogout();
      document.getElementById('loginModal').style.display = 'flex';
      document.getElementById('adminUser').textContent = '';
      document.getElementById('adminUserSidebar').textContent = '';
      showToast('已登出', 'info');
    };
  });

  // 编辑器事件
  document.getElementById('editorSave').onclick = saveRecord;
  document.getElementById('editorCancel').onclick = closeEditor;
  document.getElementById('editorClose').onclick = closeEditor;

  // 图片上传
  document.getElementById('uploadImageBtn').onclick = () => document.getElementById('imageFileInput').click();
  document.getElementById('imageFileInput').onchange = async (e) => {
    if (e.target.files.length) {
      await uploadImage(e.target.files[0]);
      e.target.value = '';
    }
  };

  // 导航
  document.querySelectorAll('.sidebar-nav a, .nav-menu a').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) navigateAdmin(view);
    };
  });

  // 移动端菜单
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('navMenu');
  if (hamburger && menu) {
    hamburger.onclick = () => menu.classList.toggle('open');
    menu.querySelectorAll('a').forEach(link => {
      link.onclick = () => menu.classList.remove('open');
    });
  }

  // 检查登录状态
  const user = await checkSession();
  if (user) {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminUser').textContent = user.email;
    document.getElementById('adminUserSidebar').textContent = user.email;
    await loadAdminData();
    navigateAdmin('learning');
  }
}

if (document.readyState === 'complete') initAdmin();
else window.addEventListener('load', initAdmin);
