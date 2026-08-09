/* ========================================
 阿历的个人主页 — 核心逻辑
 ======================================== */

const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IcCmQ1r0JQd8S_0x_ZT8tg_3oa_w4sd';
const SUPABASE_REST = SUPABASE_URL + '/rest/v1/';

const BUCKET_IMAGES = 'learning-images';
const BUCKET_FILES = 'learning-files';
const BUCKET_ASSETS = 'assets';

function getBucketUrl(bucket, path) {
  return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
}

let quillEditor = null;
let currentAdminTab = 'projects';
let currentEditId = null;
let currentEditType = null;
let uploadedFiles = [];
let currentBlogId = null;
let currentEssayId = null;

let cache = { projects: [], certificates: [], blogs: [], essays: [], profile: null };

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  initDragUpload();
});

// ========== Supabase HTTP 请求 ==========
async function sbFetch(table, options = {}) {
  let urlStr = SUPABASE_REST + table;
  if (options.query) {
    const params = new URLSearchParams();
    Object.entries(options.query).forEach(([k, v]) => {
      if (Array.isArray(v)) params.set(k, v.join(','));
      else params.set(k, String(v));
    });
    urlStr += '?' + params.toString();
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation'
  };

  console.log('[SB Fetch]', options.method || 'GET', urlStr);

  const res = await fetch(urlStr, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[SB Error]', res.status, errText);
    throw new Error(errText.substring(0, 300));
  }

  if (res.status === 204) return null;
  const data = await res.json();
  console.log('[SB OK]', table, Array.isArray(data) ? data.length + '条' : '1条');
  return data;
}

async function sbUpload(file, path, bucket) {
  bucket = bucket || (file.type.startsWith('image/') ? BUCKET_IMAGES : BUCKET_FILES);
  const url = SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    body: file
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('上传失败: ' + err);
  }
  return getBucketUrl(bucket, path);
}

// ========== 加载所有数据（带容错）==========
async function loadAllData() {
  try {
    await loadProjects();
  } catch (e) { console.error('projects:', e); }

  try {
    await loadCertificates();
  } catch (e) { console.error('certificates:', e); }

  try {
    await loadBlogs();
  } catch (e) { console.error('blogs:', e); }

  try {
    await loadEssays();
  } catch (e) { 
    console.error('essays:', e);
    // 如果 essays 表不存在，尝试从 posts 表读取
    try {
      const posts = await sbFetch('posts', { query: { order: 'created_at.desc' } });
      if (posts) {
        cache.essays = posts.map(p => ({
          id: p.id,
          content: p.content || p.title || '',
          images: p.images || [],
          mood: p.mood || '😊',
          location: p.location || '',
          created_at: p.created_at,
          updated_at: p.updated_at
        }));
        renderEssays();
      }
    } catch (e2) { console.error('posts fallback:', e2); }
  }

  renderFeaturedProjects();
  renderLatestBlogs();
}

// ========== 项目案例 ==========
async function loadProjects() {
  const data = await sbFetch('projects', {
    query: { order: 'sort_order.asc,created_at.desc' }
  });
  cache.projects = data || [];
  renderProjects();
}

function renderProjects() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  const items = cache.projects;
  grid.innerHTML = items.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <div class="project-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.title)}" loading="lazy">` : '<div class="project-img-placeholder">📊</div>'}
      </div>
      <div class="project-body">
        <div class="project-tags">
          ${(p.tags || []).map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="project-title">${escapeHtml(p.title)}</div>
        <div class="project-desc">${escapeHtml(p.description || '')}</div>
        <div class="project-meta">
          <span>${escapeHtml(p.category || '数据分析')}</span>
          <span class="project-link">查看详情 →</span>
        </div>
      </div>
    </div>
  `).join('') || '<div class="loading-state">暂无项目案例，去管理后台添加吧</div>';
}

function renderFeaturedProjects() {
  const featured = document.getElementById('featuredProjectsGrid');
  if (!featured) return;
  const items = cache.projects.slice(0, 4);
  featured.innerHTML = items.map(p => `
    <div class="project-card" onclick="openProject('${p.id}')">
      <div class="project-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${escapeHtml(p.title)}" loading="lazy">` : '<div class="project-img-placeholder">📊</div>'}
      </div>
      <div class="project-body">
        <div class="project-tags">
          ${(p.tags || []).map(t => `<span class="project-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="project-title">${escapeHtml(p.title)}</div>
        <div class="project-desc">${escapeHtml(p.description || '')}</div>
      </div>
    </div>
  `).join('') || '<div class="loading-state">暂无项目</div>';
}

function openProject(id) {
  const p = cache.projects.find(x => String(x.id) === String(id));
  if (!p) return;
  document.getElementById('blogDetailContent').innerHTML = `
    <div class="blog-detail">
      <h1>${escapeHtml(p.title)}</h1>
      <div class="blog-detail-meta">
        <span>${escapeHtml(p.category || '数据分析')}</span>
        <span>${formatDate(p.created_at)}</span>
      </div>
      <div class="blog-detail-tags">
        ${(p.tags || []).map(t => `<span class="blog-detail-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      ${p.image_url ? `<img src="${p.image_url}" style="width:100%;border-radius:12px;margin-bottom:24px;" alt="${escapeHtml(p.title)}">` : ''}
      <div class="blog-detail-content"><p>${escapeHtml(p.description || '暂无详细描述')}</p></div>
      ${p.file_url ? `
        <div class="blog-detail-attachments">
          <h4>📎 附件下载</h4>
          <div class="attachment-list">
            <div class="attachment-item"><span>📄</span><a href="${p.file_url}" target="_blank">下载项目文件 (${escapeHtml(p.file_type || '文件')})</a></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  showSection('blogDetail');
}

// ========== 证书 ==========
async function loadCertificates() {
  const data = await sbFetch('certificates', {
    query: { order: 'sort_order.asc,created_at.desc' }
  });
  cache.certificates = data || [];
  renderCertificates();
}

function renderCertificates() {
  const grid = document.getElementById('certsGrid');
  if (!grid) return;
  const items = cache.certificates;
  grid.innerHTML = items.map(c => `
    <div class="cert-card">
      <div class="cert-img">
        ${c.image_url ? `<img src="${c.image_url}" alt="${escapeHtml(c.title)}" loading="lazy">` : '<div class="project-img-placeholder">🏆</div>'}
      </div>
      <div class="cert-body">
        <div class="cert-title">${escapeHtml(c.title)}</div>
        <div class="cert-meta">${escapeHtml(c.issuer || '')} · ${formatDate(c.issue_date)}</div>
      </div>
    </div>
  `).join('') || '<div class="loading-state">暂无证书</div>';
}

// ========== 博客 ==========
async function loadBlogs() {
  const data = await sbFetch('blogs', {
    query: { order: 'is_pinned.desc,created_at.desc' }
  });
  cache.blogs = data || [];
  renderBlogs();
}

function renderBlogs() {
  const grid = document.getElementById('blogsGrid');
  if (!grid) return;
  const items = cache.blogs;
  grid.innerHTML = items.map(b => `
    <div class="blog-card" onclick="openBlogDetail('${b.id}')">
      ${b.cover_image ? `<img class="blog-cover" src="${b.cover_image}" alt="${escapeHtml(b.title)}" loading="lazy">` : ''}
      <div class="blog-meta">
        <span>${formatDate(b.created_at)}</span>
        ${b.is_pinned ? '<span style="font-weight:600">📌 置顶</span>' : ''}
      </div>
      <div class="blog-title">${escapeHtml(b.title)}</div>
      <div class="blog-excerpt">${escapeHtml(b.excerpt || stripHtml(b.content).substring(0, 120) + '...')}</div>
      <div class="blog-readmore">阅读全文 →</div>
    </div>
  `).join('') || '<div class="loading-state">暂无学习笔记，去写一篇吧</div>';
}

function renderLatestBlogs() {
  const grid = document.getElementById('latestBlogsGrid');
  if (!grid) return;
  const items = cache.blogs.slice(0, 4);
  grid.innerHTML = items.map(b => `
    <div class="blog-card" onclick="openBlogDetail('${b.id}')">
      ${b.cover_image ? `<img class="blog-cover" src="${b.cover_image}" alt="${escapeHtml(b.title)}" loading="lazy">` : ''}
      <div class="blog-meta">
        <span>${formatDate(b.created_at)}</span>
        ${b.is_pinned ? '<span style="font-weight:600">📌 置顶</span>' : ''}
      </div>
      <div class="blog-title">${escapeHtml(b.title)}</div>
      <div class="blog-excerpt">${escapeHtml(b.excerpt || stripHtml(b.content).substring(0, 120) + '...')}</div>
      <div class="blog-readmore">阅读全文 →</div>
    </div>
  `).join('') || '<div class="loading-state">暂无笔记</div>';
}

function openBlogDetail(id) {
  const b = cache.blogs.find(x => String(x.id) === String(id));
  if (!b) return;
  currentBlogId = id;

  let attachmentsHtml = '';
  if (b.attachments && b.attachments.length > 0) {
    attachmentsHtml = `
      <div class="blog-detail-attachments">
        <h4>📎 附件</h4>
        <div class="attachment-list">
          ${b.attachments.map(att => `<div class="attachment-item"><span>📄</span><a href="${att.url}" target="_blank">${escapeHtml(att.name)}</a></div>`).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('blogDetailContent').innerHTML = `
    <h1>${escapeHtml(b.title)}</h1>
    <div class="blog-detail-meta">
      <span>${formatDate(b.created_at)}</span>
      <span>${b.view_count || 0} 次阅读</span>
    </div>
    <div class="blog-detail-tags">
      ${(b.tags || []).map(t => `<span class="blog-detail-tag">${escapeHtml(t)}</span>`).join('')}
    </div>
    ${b.cover_image ? `<img src="${b.cover_image}" style="width:100%;border-radius:12px;margin-bottom:24px;" alt="${escapeHtml(b.title)}">` : ''}
    <div class="blog-detail-content">${b.content || ''}</div>
    ${attachmentsHtml}
  `;
  showSection('blogDetail');
  sbFetch('blogs?id=eq.' + id, {
    method: 'PATCH',
    body: { view_count: (b.view_count || 0) + 1 }
  }).catch(() => {});
}

function backToBlogs() {
  currentBlogId = null;
  showSection('blogs');
}

function editCurrentBlog() {
  if (!currentBlogId) return;
  const b = cache.blogs.find(x => String(x.id) === String(currentBlogId));
  if (b) openBlogEditor(b);
}

async function deleteCurrentBlog() {
  if (!currentBlogId) return;
  if (!confirm('确定要删除这篇笔记吗？')) return;
  try {
    await sbFetch('blogs?id=eq.' + currentBlogId, { method: 'DELETE', prefer: 'return=minimal' });
    showToast('删除成功');
    await loadBlogs();
    backToBlogs();
  } catch (e) {
    showToast('删除失败: ' + e.message);
  }
}

// ========== 随笔 ==========
async function loadEssays() {
  const data = await sbFetch('essays', {
    query: { order: 'created_at.desc' }
  });
  cache.essays = data || [];
  renderEssays();
}

function renderEssays() {
  const grid = document.getElementById('essaysGrid');
  if (!grid) return;
  const items = cache.essays;
  grid.innerHTML = items.map(e => {
    const imgCount = (e.images || []).length;
    const imgClass = imgCount === 1 ? 'single' : '';
    return `
    <div class="life-card" onclick="openEssayDetail('${e.id}')">
      ${imgCount > 0 ? `
        <div class="life-images ${imgClass}">
          ${(e.images || []).slice(0, 4).map(img => `<img src="${img}" loading="lazy">`).join('')}
        </div>
      ` : '<div class="life-mood">' + (e.mood || '😊') + '</div>'}
      <div class="life-text">${escapeHtml(e.content)}</div>
      <div class="life-footer">
        <span>${escapeHtml(e.location || '')}</span>
        <span>${formatDate(e.created_at)}</span>
      </div>
    </div>
  `}).join('') || '<div class="loading-state">暂无生活随笔，去发一条吧</div>';
}

function openEssayDetail(id) {
  const e = cache.essays.find(x => String(x.id) === String(id));
  if (!e) return;
  currentEssayId = id;

  let imagesHtml = '';
  if (e.images && e.images.length > 0) {
    imagesHtml = `<div class="essay-images">${e.images.map(img => `<img src="${img}">`).join('')}</div>`;
  }

  document.getElementById('essayDetailContent').innerHTML = `
    <div class="essay-mood">${e.mood || '😊'}</div>
    <div class="essay-text">${escapeHtml(e.content)}</div>
    ${imagesHtml}
    <div class="essay-meta">
      ${e.location ? '📍 ' + escapeHtml(e.location) + ' · ' : ''}${formatDate(e.created_at)}
    </div>
  `;
  showSection('essayDetail');
}

function backToEssays() {
  currentEssayId = null;
  showSection('essays');
}

function editCurrentEssay() {
  if (!currentEssayId) return;
  const e = cache.essays.find(x => String(x.id) === String(currentEssayId));
  if (e) openEssayEditor(e);
}

async function deleteCurrentEssay() {
  if (!currentEssayId) return;
  if (!confirm('确定要删除这条随笔吗？')) return;
  try {
    await sbFetch('essays?id=eq.' + currentEssayId, { method: 'DELETE', prefer: 'return=minimal' });
    showToast('删除成功');
    await loadEssays();
    backToEssays();
  } catch (e) {
    showToast('删除失败: ' + e.message);
  }
}

// ========== 导航切换 ==========
function showSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const navLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
  if (navLink) navLink.classList.add('active');

  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('mobileMenuBtn').classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('mobileMenuBtn').classList.toggle('active');
}

function toggleAdmin() {
  showSection('admin');
  renderAdminList();
}

// ========== 二维码 ==========
function showQR(type) {
  const map = {
    wechat: { img: 'wechat.jpg', text: '微信扫码添加' },
    xiaohongshu: { img: 'xiaohongshu.jpg', text: '小红书扫码关注' },
    qq: { img: 'qq.jpg', text: 'QQ扫码添加' }
  };
  const info = map[type];
  if (!info) return;
  document.getElementById('qrImg').src = info.img;
  document.getElementById('qrText').textContent = info.text;
  document.getElementById('qrModal').classList.add('active');
}

function closeQR(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('qrModal').classList.remove('active');
}

// ========== 编辑器 ==========
function initQuill() {
  if (quillEditor) return;
  quillEditor = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: '开始写作...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        ['blockquote', 'code-block'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'],
        ['clean']
      ]
    }
  });
}

function openBlogEditor(item = null) {
  currentEditType = 'blogs';
  currentEditId = item ? item.id : null;
  document.getElementById('editorTitle').textContent = item ? '编辑学习笔记' : '新建学习笔记';
  document.getElementById('richEditorGroup').style.display = 'block';
  document.getElementById('fileUploadGroup').style.display = 'block';

  document.getElementById('editorFields').innerHTML = `
    <div class="form-group">
      <label>标题 *</label>
      <input type="text" id="editTitle" value="${item ? escapeHtml(item.title) : ''}" required>
    </div>
    <div class="form-group">
      <label>摘要</label>
      <textarea id="editExcerpt" rows="2">${item ? escapeHtml(item.excerpt || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label>封面图片 URL</label>
      <input type="text" id="editCover" value="${item ? escapeHtml(item.cover_image || '') : ''}" placeholder="可上传或填写图片链接">
    </div>
    <div class="form-group">
      <label>标签（逗号分隔）</label>
      <input type="text" id="editTags" value="${item ? (item.tags || []).join(', ') : ''}" placeholder="数据分析, RFM, 电商">
    </div>
    <div class="form-group">
      <label><input type="checkbox" id="editPinned" ${item && item.is_pinned ? 'checked' : ''}> 置顶</label>
    </div>
  `;

  uploadedFiles = [];
  document.getElementById('uploadPreview').innerHTML = '';
  if (item && item.attachments) {
    item.attachments.forEach(att => uploadedFiles.push({ url: att.url, name: att.name, isImage: false }));
    renderUploadPreview();
  }

  document.getElementById('editorModal').classList.add('active');
  setTimeout(() => {
    initQuill();
    quillEditor.root.innerHTML = item && item.content ? item.content : '';
  }, 100);
}

function openEssayEditor(item = null) {
  currentEditType = 'essays';
  currentEditId = item ? item.id : null;
  document.getElementById('editorTitle').textContent = item ? '编辑随笔' : '新建随笔';
  document.getElementById('richEditorGroup').style.display = 'none';
  document.getElementById('fileUploadGroup').style.display = 'block';

  document.getElementById('editorFields').innerHTML = `
    <div class="form-group">
      <label>内容 *</label>
      <textarea id="editContent" rows="6" required>${item ? escapeHtml(item.content) : ''}</textarea>
    </div>
    <div class="form-group">
      <label>心情表情</label>
      <input type="text" id="editMood" value="${item ? escapeHtml(item.mood || '') : '😊'}" placeholder="😊">
    </div>
    <div class="form-group">
      <label>位置</label>
      <input type="text" id="editLocation" value="${item ? escapeHtml(item.location || '') : ''}" placeholder="广州">
    </div>
  `;

  uploadedFiles = [];
  document.getElementById('uploadPreview').innerHTML = '';
  if (item && item.images) {
    item.images.forEach(img => uploadedFiles.push({ url: img, name: '图片', isImage: true }));
    renderUploadPreview();
  }

  document.getElementById('editorModal').classList.add('active');
}

function closeEditor() {
  document.getElementById('editorModal').classList.remove('active');
  currentEditId = null;
  currentEditType = null;
  uploadedFiles = [];
}

async function saveEditorForm() {
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.textContent = '保存中...';
  saveBtn.disabled = true;

  try {
    if (currentEditType === 'blogs') await saveBlog();
    else if (currentEditType === 'essays') await saveEssay();
    else if (currentEditType === 'projects') await saveProject();
    else if (currentEditType === 'certificates') await saveCertificate();
    closeEditor();
  } catch (e) {
    showToast('保存失败: ' + e.message);
  } finally {
    saveBtn.textContent = '保存';
    saveBtn.disabled = false;
  }
}

async function saveBlog() {
  const title = document.getElementById('editTitle').value.trim();
  if (!title) { showToast('请填写标题'); throw new Error('无标题'); }

  const excerpt = document.getElementById('editExcerpt').value.trim();
  const cover = document.getElementById('editCover').value.trim();
  const tags = document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const isPinned = document.getElementById('editPinned').checked;
  const content = quillEditor ? quillEditor.root.innerHTML : '';
  const attachments = uploadedFiles.filter(f => !f.isImage).map(f => ({ name: f.name, url: f.url }));

  const data = {
    title, content, excerpt: excerpt || null, cover_image: cover || null,
    tags, is_pinned: isPinned, attachments,
    updated_at: new Date().toISOString()
  };

  if (currentEditId) {
    await sbFetch('blogs?id=eq.' + currentEditId, { method: 'PATCH', body: data });
    showToast('笔记更新成功');
  } else {
    data.created_at = new Date().toISOString();
    data.view_count = 0;
    await sbFetch('blogs', { method: 'POST', body: data });
    showToast('笔记发布成功');
  }
  await loadBlogs();
}

async function saveEssay() {
  const content = document.getElementById('editContent').value.trim();
  if (!content) { showToast('请填写内容'); throw new Error('无内容'); }

  const mood = document.getElementById('editMood').value.trim();
  const location = document.getElementById('editLocation').value.trim();
  const images = uploadedFiles.filter(f => f.isImage).map(f => f.url);

  const data = {
    content, mood: mood || '😊', location: location || null,
    images, updated_at: new Date().toISOString()
  };

  if (currentEditId) {
    await sbFetch('essays?id=eq.' + currentEditId, { method: 'PATCH', body: data });
    showToast('随笔更新成功');
  } else {
    data.created_at = new Date().toISOString();
    await sbFetch('essays', { method: 'POST', body: data });
    showToast('随笔发布成功');
  }
  await loadEssays();
}

async function saveProject() {
  const title = document.getElementById('editTitle').value.trim();
  if (!title) { showToast('请填写标题'); throw new Error('无标题'); }

  const description = document.getElementById('editDesc').value.trim();
  const category = document.getElementById('editCategory').value.trim();
  const tags = document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const imageUrl = uploadedFiles.find(f => f.isImage)?.url || document.getElementById('editImage')?.value.trim() || '';
  const fileUrl = uploadedFiles.find(f => !f.isImage)?.url || '';
  const fileType = uploadedFiles.find(f => !f.isImage)?.name?.split('.').pop() || '';

  const data = {
    title, description: description || null, category: category || '数据分析',
    tags, image_url: imageUrl || null, file_url: fileUrl || null,
    file_type: fileType || null,
    updated_at: new Date().toISOString()
  };

  if (currentEditId) {
    await sbFetch('projects?id=eq.' + currentEditId, { method: 'PATCH', body: data });
    showToast('项目更新成功');
  } else {
    data.created_at = new Date().toISOString();
    data.sort_order = cache.projects.length;
    await sbFetch('projects', { method: 'POST', body: data });
    showToast('项目添加成功');
  }
  await loadProjects();
}

async function saveCertificate() {
  const title = document.getElementById('editTitle').value.trim();
  if (!title) { showToast('请填写标题'); throw new Error('无标题'); }

  const issuer = document.getElementById('editIssuer')?.value.trim() || '';
  const issueDate = document.getElementById('editDate')?.value || '';
  const imageUrl = uploadedFiles.find(f => f.isImage)?.url || document.getElementById('editImage')?.value.trim() || '';

  const data = {
    title, issuer: issuer || null, issue_date: issueDate || null,
    image_url: imageUrl || null,
    updated_at: new Date().toISOString()
  };

  if (currentEditId) {
    await sbFetch('certificates?id=eq.' + currentEditId, { method: 'PATCH', body: data });
    showToast('证书更新成功');
  } else {
    data.created_at = new Date().toISOString();
    data.sort_order = cache.certificates.length;
    await sbFetch('certificates', { method: 'POST', body: data });
    showToast('证书添加成功');
  }
  await loadCertificates();
}

// ========== 文件上传 ==========
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => uploadFile(file));
  event.target.value = '';
}

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const path = Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
  const isImage = file.type.startsWith('image/');

  const localUrl = URL.createObjectURL(file);
  uploadedFiles.push({ url: localUrl, name: file.name, isImage, uploading: true });
  renderUploadPreview();

  try {
    const publicUrl = await sbUpload(file, path);
    const idx = uploadedFiles.findIndex(f => f.url === localUrl);
    if (idx !== -1) {
      uploadedFiles[idx].url = publicUrl;
      uploadedFiles[idx].uploading = false;
    }
    renderUploadPreview();
    showToast('上传成功');
  } catch (e) {
    uploadedFiles = uploadedFiles.filter(f => f.url !== localUrl);
    renderUploadPreview();
    showToast('上传失败: ' + e.message);
  }
}

function renderUploadPreview() {
  const container = document.getElementById('uploadPreview');
  container.innerHTML = uploadedFiles.map((f, i) => `
    <div class="upload-preview-item">
      ${f.isImage ? `<img src="${f.url}" alt="${escapeHtml(f.name)}">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;">📄</div>'}
      ${f.uploading ? '<div style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;">上传中...</div>' : ''}
      <div class="upload-file-name">${escapeHtml(f.name)}</div>
      <button type="button" class="upload-remove" onclick="removeUploadedFile(${i})">×</button>
    </div>
  `).join('');
}

function removeUploadedFile(index) {
  uploadedFiles.splice(index, 1);
  renderUploadPreview();
}

function initDragUpload() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--text)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    Array.from(e.dataTransfer.files).forEach(file => uploadFile(file));
  });
}

// ========== 管理后台 ==========
function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderAdminList();
}

function renderAdminList() {
  const list = document.getElementById('adminList');
  let items = [];
  let type = currentAdminTab;

  if (type === 'projects') items = cache.projects;
  else if (type === 'certificates') items = cache.certificates;
  else if (type === 'blogs') items = cache.blogs;
  else if (type === 'essays') items = cache.essays;

  list.innerHTML = items.map(item => {
    const title = item.title || (item.content ? item.content.substring(0, 30) + '...' : '未命名');
    const date = formatDate(item.created_at);
    return `
      <div class="admin-item">
        <div class="admin-item-info">
          <div class="admin-item-title">${escapeHtml(title)}</div>
          <div class="admin-item-meta">${date}</div>
        </div>
        <div class="admin-item-actions">
          <button class="edit-btn" onclick="adminEditItem('${type}', '${item.id}')">编辑</button>
          <button class="delete-btn" onclick="adminDeleteItem('${type}', '${item.id}')">删除</button>
        </div>
      </div>
    `;
  }).join('') || '<div class="loading-state">暂无数据</div>';
}

function adminNewItem() {
  if (currentAdminTab === 'projects') openProjectEditor();
  else if (currentAdminTab === 'certificates') openCertificateEditor();
  else if (currentAdminTab === 'blogs') openBlogEditor();
  else if (currentAdminTab === 'essays') openEssayEditor();
}

function openProjectEditor(item = null) {
  currentEditType = 'projects';
  currentEditId = item ? item.id : null;
  document.getElementById('editorTitle').textContent = item ? '编辑项目' : '新建项目';
  document.getElementById('richEditorGroup').style.display = 'none';
  document.getElementById('fileUploadGroup').style.display = 'block';

  document.getElementById('editorFields').innerHTML = `
    <div class="form-group">
      <label>标题 *</label>
      <input type="text" id="editTitle" value="${item ? escapeHtml(item.title) : ''}" required>
    </div>
    <div class="form-group">
      <label>描述</label>
      <textarea id="editDesc" rows="3">${item ? escapeHtml(item.description || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label>分类</label>
      <input type="text" id="editCategory" value="${item ? escapeHtml(item.category || '') : '数据分析'}" placeholder="数据分析">
    </div>
    <div class="form-group">
      <label>标签（逗号分隔）</label>
      <input type="text" id="editTags" value="${item ? (item.tags || []).join(', ') : ''}">
    </div>
    <div class="form-group">
      <label>图片 URL（或上传）</label>
      <input type="text" id="editImage" value="${item ? escapeHtml(item.image_url || '') : ''}">
    </div>
  `;

  uploadedFiles = [];
  document.getElementById('uploadPreview').innerHTML = '';
  if (item && item.image_url) uploadedFiles.push({ url: item.image_url, name: '封面图', isImage: true });
  if (item && item.file_url) uploadedFiles.push({ url: item.file_url, name: item.file_type || '附件', isImage: false });
  renderUploadPreview();

  document.getElementById('editorModal').classList.add('active');
}

function openCertificateEditor(item = null) {
  currentEditType = 'certificates';
  currentEditId = item ? item.id : null;
  document.getElementById('editorTitle').textContent = item ? '编辑证书' : '新建证书';
  document.getElementById('richEditorGroup').style.display = 'none';
  document.getElementById('fileUploadGroup').style.display = 'block';

  document.getElementById('editorFields').innerHTML = `
    <div class="form-group">
      <label>证书名称 *</label>
      <input type="text" id="editTitle" value="${item ? escapeHtml(item.title) : ''}" required>
    </div>
    <div class="form-group">
      <label>颁发机构</label>
      <input type="text" id="editIssuer" value="${item ? escapeHtml(item.issuer || '') : ''}">
    </div>
    <div class="form-group">
      <label>获得日期</label>
      <input type="date" id="editDate" value="${item ? escapeHtml(item.issue_date || '') : ''}">
    </div>
    <div class="form-group">
      <label>图片 URL（或上传）</label>
      <input type="text" id="editImage" value="${item ? escapeHtml(item.image_url || '') : ''}">
    </div>
  `;

  uploadedFiles = [];
  document.getElementById('uploadPreview').innerHTML = '';
  if (item && item.image_url) uploadedFiles.push({ url: item.image_url, name: '证书图', isImage: true });
  renderUploadPreview();

  document.getElementById('editorModal').classList.add('active');
}

function adminEditItem(type, id) {
  const item = cache[type].find(x => String(x.id) === String(id));
  if (!item) return;
  if (type === 'projects') openProjectEditor(item);
  else if (type === 'certificates') openCertificateEditor(item);
  else if (type === 'blogs') openBlogEditor(item);
  else if (type === 'essays') openEssayEditor(item);
}

async function adminDeleteItem(type, id) {
  if (!confirm('确定要删除吗？此操作不可恢复。')) return;
  try {
    await sbFetch(type + '?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
    showToast('删除成功');
    if (type === 'projects') await loadProjects();
    else if (type === 'certificates') await loadCertificates();
    else if (type === 'blogs') await loadBlogs();
    else if (type === 'essays') await loadEssays();
    renderAdminList();
  } catch (e) {
    showToast('删除失败: ' + e.message);
  }
}

// ========== 工具函数 ==========
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditor();
    closeQR();
  }
});
