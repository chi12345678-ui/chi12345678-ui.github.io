// ============================================================
// js/config.js
// Supabase 配置 + 公共工具函数
// ============================================================

// ----- Supabase 配置（已确认） -----
export const SUPABASE_URL = 'https://bqdhqnviozvqljjigzys.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxZGhxbnZpb3p2cWxqamlnenlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTA4MTYsImV4cCI6MjEwMDI4NjgxNn0.aoFWYdp_9kwB1y741zfnziMYjq7cPnLGCrDApgdmrmE';

export const TABLES = {
  LEARNING: 'learning',
  ESSAYS: 'essays',
  PROJECTS: 'projects'
};

// ----- Supabase 客户端（单例） -----
let _client = null;

export function getSupabaseClient() {
  if (_client) return _client;
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    throw new Error('Supabase SDK 未加载');
  }
  _client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: true }
  });
  return _client;
}

// ============================================================
// 工具函数
// ============================================================

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  return formatDate(iso);
}

// ----- Toast -----
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function showToast(message, type = 'info', duration = 3000) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ----- HTML 转义 -----
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ----- 项目简介截取 -----
export function getProjectExcerpt(markdown, maxLen = 150) {
  if (!markdown) return '';
  let text = markdown.replace(/```[\s\S]*?```/g, '');
  text = text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/>\s/g, '')
    .replace(/[-*+]\s/g, '')
    .replace(/\n/g, ' ')
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen) + '...';
  return text;
}

// ----- Loading -----
let loadingEl = null;

export function showLoading(msg = '加载中...') {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.className = 'loading-overlay';
  loadingEl.innerHTML = `<div class="loading-spinner"></div><p>${msg}</p>`;
  document.body.appendChild(loadingEl);
}

export function hideLoading() {
  if (loadingEl) { loadingEl.remove(); loadingEl = null; }
}
