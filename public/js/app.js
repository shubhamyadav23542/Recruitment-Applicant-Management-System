/**
 * HomiesLab SaaS HR Admin Panel UI
 * Core Application Framework & Routing
 */

const APP_STATE = {
  admin: null,
  token: null,
  isLoggedIn: false,
  currentTab: 'dashboard',
  jobsList: [],
  selectedModalRole: 'recruiter'
};

// Check authentication - Does NOT force redirect to login.html; supports guest viewing & in-page sign-in!
function checkAuth() {
  const token = localStorage.getItem('ats_token');
  const adminData = localStorage.getItem('ats_admin') || localStorage.getItem('ats_user');

  if (token && adminData) {
    try {
      APP_STATE.token = token;
      APP_STATE.admin = JSON.parse(adminData);
      APP_STATE.isLoggedIn = true;
      updateAdminUI();
      return true;
    } catch (e) {
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_admin');
      APP_STATE.token = null;
      APP_STATE.admin = null;
      APP_STATE.isLoggedIn = false;
    }
  } else {
    APP_STATE.token = null;
    APP_STATE.admin = null;
    APP_STATE.isLoggedIn = false;
  }

  updateAdminUI();
  return true;
}

// Update Admin Info in Sidebar Capsule & Top Nav
function updateAdminUI() {
  const nameEl = document.getElementById('adminUserName');
  const roleEl = document.getElementById('adminUserRole');
  const avatarEl = document.getElementById('capsuleAvatar');
  const greetingEl = document.getElementById('greetingHeadline');

  const navSignInBtn = document.getElementById('navSignInBtn');
  const navDemoBtn = document.getElementById('navDemoBtn');
  const navPostJobBtn = document.getElementById('navPostJobBtn');
  const navLogoutBtn = document.getElementById('navLogoutBtn');

  if (APP_STATE.isLoggedIn && APP_STATE.admin) {
    const adminName = APP_STATE.admin.full_name || APP_STATE.admin.username || 'Oscar Carol';
    const adminRole = APP_STATE.admin.role || 'HR Recruiter';
    const initial = adminName.charAt(0).toUpperCase();

    if (nameEl) nameEl.textContent = adminName;
    if (roleEl) roleEl.textContent = adminRole;
    if (avatarEl) avatarEl.textContent = initial;
    if (greetingEl) {
      const firstName = adminName.split(' ')[0] || 'Homies';
      greetingEl.textContent = `Good Morning, ${firstName}`;
    }

    if (navSignInBtn) navSignInBtn.style.display = 'none';
    if (navDemoBtn) navDemoBtn.style.display = 'none';
    if (navPostJobBtn) navPostJobBtn.style.display = 'inline-flex';
    if (navLogoutBtn) navLogoutBtn.style.display = 'inline-flex';
  } else {
    // Guest View
    if (nameEl) nameEl.textContent = 'Guest Visitor';
    if (roleEl) roleEl.textContent = 'Click to Sign In';
    if (avatarEl) avatarEl.textContent = '👤';
    if (greetingEl) {
      greetingEl.textContent = `Welcome to HomiesLab`;
    }

    if (navSignInBtn) navSignInBtn.style.display = 'inline-flex';
    if (navDemoBtn) navDemoBtn.style.display = 'inline-flex';
    if (navPostJobBtn) navPostJobBtn.style.display = 'none';
    if (navLogoutBtn) navLogoutBtn.style.display = 'none';
  }
}

// Capsule click handler
function handleCapsuleClick() {
  if (APP_STATE.isLoggedIn) {
    logoutAdmin();
  } else {
    openLoginModal('recruiter');
  }
}

// Authenticated API Fetch wrapper
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('ats_token');
  const isWriteMethod = options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase());

  // If a write operation requires authentication but user is not logged in:
  if (isWriteMethod && !token) {
    showToast('Please sign in as Recruiter to perform this action.', 'warning');
    openLoginModal('recruiter');
    return null;
  }

  const defaultHeaders = {};
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  options.headers = { ...defaultHeaders, ...options.headers };

  try {
    const response = await fetch(endpoint, options);

    if (response.status === 401) {
      showToast('Session expired or authentication required. Please sign in.', 'warning');
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_admin');
      APP_STATE.isLoggedIn = false;
      updateAdminUI();
      openLoginModal('recruiter');
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
  localStorage.removeItem('ats_user');
  localStorage.removeItem('ats_role');
  APP_STATE.token = null;
  APP_STATE.admin = null;
  APP_STATE.isLoggedIn = false;
  updateAdminUI();
  showToast('Logged out successfully.', 'info');
  // Re-render current tab in guest mode
  switchTab(APP_STATE.currentTab || 'dashboard');
}

// =====================================================================
// IN-PAGE LOGIN / REGISTRATION MODAL CONTROLLER
// =====================================================================
function openLoginModal(defaultRole = 'recruiter') {
  APP_STATE.selectedModalRole = defaultRole;
  const modal = document.getElementById('loginModal');
  if (!modal) {
    window.location.href = 'login.html';
    return;
  }

  modal.classList.add('active');
  selectModalRole(defaultRole);
  switchModalTab('signin');
  clearModalAlert();
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('active');
}

function selectModalRole(role) {
  APP_STATE.selectedModalRole = role;
  const recCard = document.getElementById('modalRoleRecruiter');
  const candCard = document.getElementById('modalRoleCandidate');
  const extraFields = document.getElementById('modalCandidateExtraFields');
  const demoLabel = document.getElementById('modalDemoLabel');
  const demoCred = document.getElementById('modalDemoCred');
  const submitText = document.getElementById('modalSignInSubmitText');

  if (recCard) recCard.classList.toggle('selected', role === 'recruiter');
  if (candCard) candCard.classList.toggle('selected', role === 'candidate');

  if (role === 'recruiter') {
    if (extraFields) extraFields.style.display = 'none';
    if (demoLabel) demoLabel.textContent = '⚡ Demo Recruiter Account';
    if (demoCred) demoCred.textContent = 'admin@recruitment.com / admin123';
    if (submitText) submitText.textContent = 'Sign In as Recruiter';
  } else {
    if (extraFields) extraFields.style.display = 'block';
    if (demoLabel) demoLabel.textContent = '⚡ Demo Candidate Account';
    if (demoCred) demoCred.textContent = 'candidate@example.com / candidate123';
    if (submitText) submitText.textContent = 'Sign In as Candidate';
  }
}

function switchModalTab(tab) {
  const isSignIn = tab === 'signin';
  const tabIn = document.getElementById('modalTabSignIn');
  const tabUp = document.getElementById('modalTabSignUp');
  const formIn = document.getElementById('modalSignInForm');
  const formUp = document.getElementById('modalSignUpForm');

  if (tabIn) tabIn.classList.toggle('active', isSignIn);
  if (tabUp) tabUp.classList.toggle('active', !isSignIn);
  if (formIn) formIn.style.display = isSignIn ? 'block' : 'none';
  if (formUp) formUp.style.display = isSignIn ? 'none' : 'block';
  clearModalAlert();
}

function showModalAlert(msg, type = 'error') {
  const box = document.getElementById('modalAlertBox');
  if (box) {
    box.textContent = msg;
    box.className = `alert-box ${type}`;
    box.style.display = 'block';
  }
}

function clearModalAlert() {
  const box = document.getElementById('modalAlertBox');
  if (box) {
    box.style.display = 'none';
    box.textContent = '';
  }
}

async function handleModalSignIn(e) {
  e.preventDefault();
  clearModalAlert();

  const email = document.getElementById('modalSiEmail').value.trim();
  const password = document.getElementById('modalSiPassword').value;
  const btn = document.getElementById('modalSignInBtn');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Verifying...</span>';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: email,
        password,
        role: APP_STATE.selectedModalRole
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      applyLoginSuccess(data);
    } else {
      showModalAlert(data.message || 'Invalid credentials. Please try again.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span> →';
      }
    }
  } catch (err) {
    showModalAlert('Server connection error. Please try again.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Sign In</span> →';
    }
  }
}

async function handleModalSignUp(e) {
  e.preventDefault();
  clearModalAlert();

  const name = document.getElementById('modalSuName').value.trim();
  const email = document.getElementById('modalSuEmail').value.trim();
  const password = document.getElementById('modalSuPassword').value;
  const phone = document.getElementById('modalSuPhone') ? document.getElementById('modalSuPhone').value.trim() : '';
  const education = document.getElementById('modalSuEducation') ? document.getElementById('modalSuEducation').value.trim() : '';
  const skills = document.getElementById('modalSuSkills') ? document.getElementById('modalSuSkills').value.trim() : '';

  if (password.length < 6) {
    showModalAlert('Password must be at least 6 characters.', 'error');
    return;
  }

  const btn = document.getElementById('modalSignUpBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Creating Account...</span>';
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: name,
        email,
        password,
        role: APP_STATE.selectedModalRole,
        phone,
        education,
        skills
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`🎉 Account created! Welcome, ${name.split(' ')[0]}!`, 'success');
      applyLoginSuccess(data);
    } else {
      showModalAlert(data.message || 'Registration failed.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span> →';
      }
    }
  } catch (err) {
    showModalAlert('Server error during registration.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Create Account</span> →';
    }
  }
}

async function modalDemoLogin(role) {
  const targetRole = role || APP_STATE.selectedModalRole || 'recruiter';
  showToast(`⚡ Logging in as demo ${targetRole}...`, 'info');

  try {
    const res = await fetch('/api/auth/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: targetRole })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      applyLoginSuccess(data);
    } else {
      showModalAlert(data.message || 'Demo login failed.', 'error');
    }
  } catch (err) {
    showModalAlert('Server error during demo login.', 'error');
  }
}

// 1-Click Demo Recruiter Login from Top Nav
function quickDemoRecruiter() {
  modalDemoLogin('recruiter');
}

function applyLoginSuccess(data) {
  localStorage.setItem('ats_token', data.token);
  localStorage.setItem('ats_user', JSON.stringify(data.user || data.admin));
  localStorage.setItem('ats_role', data.role);
  if (data.admin) {
    localStorage.setItem('ats_admin', JSON.stringify(data.admin));
  }

  APP_STATE.token = data.token;
  APP_STATE.admin = data.user || data.admin;
  APP_STATE.isLoggedIn = true;

  closeLoginModal();
  updateAdminUI();

  showToast(`👋 Welcome, ${(data.user || data.admin).full_name.split(' ')[0]}!`, 'success');

  if (data.role === 'candidate') {
    setTimeout(() => { window.location.href = 'candidate-portal.html'; }, 500);
  } else {
    // Refresh current view with admin rights
    switchTab(APP_STATE.currentTab || 'dashboard');
  }
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
