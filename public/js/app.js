/**
 * HomiesLab SaaS HR Admin Panel UI
 * Core Application Framework & Routing
 */

const APP_STATE = {
  admin: null,
  token: null,
  currentTab: 'dashboard',
  jobsList: []
};

// Check authentication
function checkAuth() {
  const token = localStorage.getItem('ats_token');
  const adminData = localStorage.getItem('ats_admin');

  if (!token || !adminData) {
    window.location.href = 'login.html';
    return false;
  }

  try {
    APP_STATE.token = token;
    APP_STATE.admin = JSON.parse(adminData);
    updateAdminUI();
    return true;
  } catch (e) {
    localStorage.removeItem('ats_token');
    localStorage.removeItem('ats_admin');
    window.location.href = 'login.html';
    return false;
  }
}

// Update Admin Info in Sidebar Capsule
function updateAdminUI() {
  if (!APP_STATE.admin) return;

  const adminName = APP_STATE.admin.full_name || APP_STATE.admin.username || 'Oscar Carol';
  const adminRole = APP_STATE.admin.role || 'Lead HR Manager';
  const initial = adminName.charAt(0).toUpperCase();

  const nameEl = document.getElementById('adminUserName');
  const roleEl = document.getElementById('adminUserRole');
  const avatarEl = document.getElementById('capsuleAvatar');
  const greetingEl = document.getElementById('greetingHeadline');

  if (nameEl) nameEl.textContent = adminName;
  if (roleEl) roleEl.textContent = adminRole;
  if (avatarEl) avatarEl.textContent = initial;
  if (greetingEl) {
    const firstName = adminName.split(' ')[0] || 'Homies';
    greetingEl.textContent = `Good Morning, ${firstName}`;
  }
}

// Authenticated API Fetch wrapper
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('ats_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const defaultHeaders = { 'Authorization': `Bearer ${token}` };
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  options.headers = { ...defaultHeaders, ...options.headers };

  try {
    const response = await fetch(endpoint, options);

    if (response.status === 401) {
      showToast('Session expired. Please log in again.', 'warning');
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_admin');
      setTimeout(() => { window.location.href = 'login.html'; }, 1000);
      return null;
    }

    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    showToast('Network error while connecting to server.', 'error');
    return null;
  }
}

// Logout handler
function logoutAdmin() {
  localStorage.removeItem('ats_token');
  localStorage.removeItem('ats_admin');
  showToast('Logged out successfully.', 'info');
  setTimeout(() => { window.location.href = 'login.html'; }, 400);
}

// Tab Switching / Navigation
function switchTab(tabId) {
  APP_STATE.currentTab = tabId;
  window.location.hash = tabId;

  // Update Bento Nav Tiles active state
  document.querySelectorAll('.bento-nav-tile[data-tab]').forEach(tile => {
    tile.classList.toggle('active', tile.dataset.tab === tabId);
  });

  // Update Tab Views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = view.id === `${tabId}View` ? 'block' : 'none';
  });

  // Update Breadcrumb Text
  const breadcrumb = document.getElementById('currentBreadcrumbText');
  if (breadcrumb) {
    const titles = {
      dashboard: 'Dashboard',
      jobs: 'Job Postings',
      applications: 'Applicants & Screening',
      shortlist: 'Shortlisted Talent',
      interviews: 'Scheduled Interviews'
    };
    breadcrumb.textContent = titles[tabId] || 'Workspace';
  }

  // Close mobile sidebar if open
  const sidebar = document.getElementById('homiesSidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');

  // Trigger tab-specific loaders
  if (tabId === 'dashboard' && window.loadDashboardStats) {
    window.loadDashboardStats();
  } else if (tabId === 'jobs' && window.loadJobs) {
    window.loadJobs();
  } else if (tabId === 'applications' && window.loadApplications) {
    window.loadApplications();
  } else if (tabId === 'shortlist' && window.loadShortlist) {
    window.loadShortlist();
  } else if (tabId === 'interviews' && window.loadInterviews) {
    window.loadInterviews();
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  const icons = { success: '✓', error: '✕', warning: '⚠', info: '🔔' };
  toast.innerHTML = `
    <span style="font-size: 16px; font-weight: 800;">${icons[type] || '🔔'}</span>
    <span style="flex: 1; font-weight: 600;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

// Modal Management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Confirmation Dialog Modal
function confirmAction({ title, message, onConfirm }) {
  const modal = document.getElementById('confirmActionModal');
  if (!modal) return;

  document.getElementById('confirmModalTitle').textContent = title || 'Confirm Action';
  document.getElementById('confirmModalMessage').textContent = message || 'Are you sure?';

  const confirmBtn = document.getElementById('confirmModalSubmitBtn');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', async () => {
    closeModal('confirmActionModal');
    if (typeof onConfirm === 'function') await onConfirm();
  });

  openModal('confirmActionModal');
}

// Status Badges (HomiesLab Pill Badges)
function getStatusBadge(status) {
  const map = {
    'Active': { cls: 'badge-active', text: 'Active' },
    'Closed': { cls: 'badge-rejected', text: 'Closed' },
    'Pending': { cls: 'badge-pending', text: 'Pending' },
    'Under Review': { cls: 'badge-interview', text: 'Under Review' },
    'Shortlisted': { cls: 'badge-shortlisted', text: 'Shortlisted' },
    'Interview Scheduled': { cls: 'badge-interview', text: 'Interview' },
    'Selected': { cls: 'badge-selected', text: 'Selected' },
    'Rejected': { cls: 'badge-rejected', text: 'Rejected' },
    'Scheduled': { cls: 'badge-interview', text: 'Scheduled' },
    'Completed': { cls: 'badge-selected', text: 'Completed' },
    'Cancelled': { cls: 'badge-rejected', text: 'Cancelled' }
  };

  const item = map[status] || { cls: 'badge-pending', text: status };
  return `<span class="badge-pill ${item.cls}">${escapeHtml(item.text)}</span>`;
}

// Formatters
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// Update live date in header
function updateHeaderDate() {
  const dateEl = document.getElementById('greetingDateText');
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    dateEl.textContent = `It's ${now.toLocaleDateString('en-US', options)}`;
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAuth()) return;
  updateHeaderDate();

  // 2x3 Bento Navigation Tiles Click
  document.querySelectorAll('.bento-nav-tile[data-tab]').forEach(tile => {
    tile.addEventListener('click', () => {
      switchTab(tile.dataset.tab);
    });
  });

  // Mobile menu toggle
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.getElementById('homiesSidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Load initial tab from hash or default to dashboard
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  switchTab(initialHash);
});
