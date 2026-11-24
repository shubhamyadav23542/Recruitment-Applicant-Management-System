/**
 * HomiesLab SaaS HR Admin Panel UI
 * Applications, Screening & Shortlisting Module
 */

let allApplicationsCache = [];
let shortlistedCache = [];

// Load Applications with filters
window.loadApplications = async function () {
  const search = document.getElementById('appSearchInput')?.value || '';
  const status = document.getElementById('appStatusFilter')?.value || 'All';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status && status !== 'All') params.append('status', status);

  const result = await apiFetch(`/api/applications?${params.toString()}`);
  if (!result || !result.ok) return;

  allApplicationsCache = result.data.applications || [];
  renderApplicationsTable(allApplicationsCache, 'applicationsTableBody', 'applicationsCountBadge');
};

// Load Dedicated Shortlist View
window.loadShortlist = async function () {
  const search = document.getElementById('shortlistSearchInput')?.value || '';

  const params = new URLSearchParams();
  params.append('is_shortlisted', '1');
  if (search) params.append('search', search);

  const result = await apiFetch(`/api/applications?${params.toString()}`);
  if (!result || !result.ok) return;

  shortlistedCache = result.data.applications || [];
  renderApplicationsTable(shortlistedCache, 'shortlistTableBody', 'shortlistCountBadge', true);
};

// Render Applications Table
function renderApplicationsTable(apps, tbodyId, countBadgeId, isShortlistView = false) {
  const tbody = document.getElementById(tbodyId);
  const countBadge = document.getElementById(countBadgeId);

  if (countBadge) {
    countBadge.textContent = `${apps.length} Candidate${apps.length === 1 ? '' : 's'}`;
  }

  if (!tbody) return;

  if (apps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
          ${isShortlistView ? 'No shortlisted candidates yet. Click the star button on any applicant to curate top talent.' : 'No candidate applications found.'}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => {
    const isShortlisted = Boolean(app.is_shortlisted);
    const initial = (app.full_name || 'C').charAt(0).toUpperCase();
    const applicantId = `APP-${app.application_id || '102'}`;
    const skillsList = (app.skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 2);

    return `
      <tr>
        <td>
          <div class="candidate-avatar-cell">
            <div class="avatar-circle">${initial}</div>
            <div>
              <div class="candidate-name-bold">${escapeHtml(app.full_name)}</div>
              <div class="candidate-sub-id">${applicantId} • 📞 ${escapeHtml(app.phone)}</div>
            </div>
          </div>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 13.5px;">${escapeHtml(app.job_title)}</strong>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(app.job_department)}</div>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${skillsList.map(s => `<span class="badge-pill" style="background: var(--bg-card-subtle); color: var(--text-main); font-size: 11px;">${escapeHtml(s)}</span>`).join('')}
          </div>
        </td>
        <td><span style="font-size: 12.5px; color: var(--text-muted);">${formatDate(app.applied_at)}</span></td>
        <td>${getStatusBadge(app.status)}</td>
        <td>
          <button type="button" class="btn-shortlist-pill ${isShortlisted ? 'active' : ''}" 
                  onclick="toggleShortlist(${app.application_id}, ${isShortlisted})">
            <span>${isShortlisted ? '★' : '☆'}</span>
            <span>${isShortlisted ? 'Shortlisted' : 'Shortlist'}</span>
          </button>
        </td>
        <td>
          ${app.resume_file ? `
            <a href="/api/applications/resume/${encodeURIComponent(app.resume_file)}" target="_blank" class="btn-primary-black" style="padding: 4px 10px; font-size: 11px; text-decoration: none;" title="Open PDF">
              📄 PDF
            </a>
          ` : '<span style="color: var(--text-muted); font-size: 11.5px;">None</span>'}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn-primary-yellow" style="padding: 5px 10px; font-size: 11px;" title="View Details" onclick="viewApplicationDetails(${app.application_id})">
              Details
            </button>
            <button type="button" class="btn-primary-black" style="padding: 5px 10px; font-size: 11px;" title="Change Status" onclick="openStatusModal(${app.application_id}, '${escapeHtml(app.status)}')">
              Status
            </button>
            <button type="button" class="card-kebab-menu" style="width: 28px; height: 28px; font-size: 11px;" title="Interview" onclick="quickScheduleInterview(${app.application_id}, '${escapeHtml(app.full_name)}', '${escapeHtml(app.job_title)}')">
              📅
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Toggle Shortlist status
async function toggleShortlist(appId, currentlyShortlisted) {
  const newFlag = !currentlyShortlisted;

  const result = await apiFetch(`/api/applications/${appId}/shortlist`, {
    method: 'PATCH',
    body: JSON.stringify({ is_shortlisted: newFlag })
  });

  if (result && result.ok) {
    showToast(result.data.message || (newFlag ? 'Candidate added to shortlist.' : 'Candidate removed from shortlist.'), 'success');
    if (APP_STATE.currentTab === 'shortlist') {
      window.loadShortlist();
    } else {
      window.loadApplications();
    }
    if (window.loadDashboardStats) window.loadDashboardStats();
  } else {
    showToast(result?.data?.message || 'Error updating shortlist.', 'error');
  }
}

// Open Status Screening Modal
function openStatusModal(appId, currentStatus) {
  const app = allApplicationsCache.find(a => a.application_id === appId) ||
              shortlistedCache.find(a => a.application_id === appId);

  document.getElementById('statusModalAppId').value = appId;
  document.getElementById('statusModalSelect').value = currentStatus || 'Pending';
  document.getElementById('statusModalNotes').value = (app && app.review_notes) || '';
  document.getElementById('statusModalCandidateName').textContent = (app && app.full_name) || 'Candidate';

  openModal('statusModal');
}

// Handle Status Screening Form Submit
async function handleStatusFormSubmit(e) {
  e.preventDefault();

  const appId = document.getElementById('statusModalAppId').value;
  const status = document.getElementById('statusModalSelect').value;
  const review_notes = document.getElementById('statusModalNotes').value.trim();

  const submitBtn = document.getElementById('saveStatusSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';

  const result = await apiFetch(`/api/applications/${appId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, review_notes })
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Update Status';

  if (result && result.ok) {
    showToast(result.data.message || `Application status changed to ${status}.`, 'success');
    closeModal('statusModal');
    if (APP_STATE.currentTab === 'shortlist') {
      window.loadShortlist();
    } else {
      window.loadApplications();
    }
    if (window.loadDashboardStats) window.loadDashboardStats();
  } else {
    showToast(result?.data?.message || 'Failed to update status.', 'error');
  }
}

// View Complete Application Profile Modal
window.viewApplicationDetails = async function (appId) {
  const result = await apiFetch(`/api/applications/${appId}`);
  if (!result || !result.ok) {
    showToast('Failed to load application profile.', 'error');
    return;
  }

  const { application: app, interviews } = result.data;

  document.getElementById('profileModalFullName').textContent = app.full_name;
  document.getElementById('profileModalEmail').textContent = app.email;
  document.getElementById('profileModalPhone').textContent = app.phone;
  document.getElementById('profileModalEducation').textContent = app.education;
  document.getElementById('profileModalExperience').textContent = app.experience;
  document.getElementById('profileModalJobTitle').textContent = app.job_title;
  document.getElementById('profileModalDept').textContent = `${app.job_department} • ${app.job_location} (${app.job_type})`;
  document.getElementById('profileModalAppliedDate').textContent = formatDate(app.applied_at);
  document.getElementById('profileModalStatusBadge').innerHTML = getStatusBadge(app.status);
  document.getElementById('profileModalCoverNote').textContent = app.cover_note || 'None provided.';

  // Render skills tags
  const skillsContainer = document.getElementById('profileModalSkills');
  const skillsList = (app.skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skillsList.map(s => `<span class="badge-pill" style="background: var(--bg-card-subtle); color: var(--text-main); font-size: 12px;">${escapeHtml(s)}</span>`).join('');

  // Resume Download / View Link
  const resumeContainer = document.getElementById('profileModalResumeAction');
  if (app.resume_file) {
    const resumeUrl = `/api/applications/resume/${encodeURIComponent(app.resume_file)}`;
    resumeContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
        <div style="font-weight: 700; font-size: 13px;">📄 ${escapeHtml(app.resume_original_name || app.resume_file)}</div>
        <a href="${resumeUrl}" target="_blank" class="btn-primary-yellow" style="padding: 6px 14px; font-size: 12px; text-decoration: none;">
          View PDF ↗
        </a>
      </div>
    `;
  } else {
    resumeContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No resume file attached.</p>';
  }

  // Interview History in Profile
  const interviewContainer = document.getElementById('profileModalInterviews');
  if (interviews && interviews.length > 0) {
    interviewContainer.innerHTML = interviews.map(i => `
      <div style="padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(i.interview_type)}</strong>
          ${getStatusBadge(i.status)}
        </div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
          📅 ${formatDate(i.interview_date)} at ${i.interview_time} • 📍 ${escapeHtml(i.location)}
        </div>
      </div>
    `).join('');
  } else {
    interviewContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12.5px;">No interviews scheduled yet.</p>';
  }

  // Set Profile Footer Actions
  const footerActionBtn = document.getElementById('profileModalScheduleBtn');
  if (footerActionBtn) {
    footerActionBtn.onclick = () => {
      closeModal('applicantProfileModal');
      quickScheduleInterview(app.application_id, app.full_name, app.job_title);
    };
  }

  const footerStatusBtn = document.getElementById('profileModalChangeStatusBtn');
  if (footerStatusBtn) {
    footerStatusBtn.onclick = () => {
      closeModal('applicantProfileModal');
      openStatusModal(app.application_id, app.status);
    };
  }

  openModal('applicantProfileModal');
};

// Attach listeners
document.addEventListener('DOMContentLoaded', () => {
  const statusForm = document.getElementById('statusForm');
  if (statusForm) statusForm.addEventListener('submit', handleStatusFormSubmit);

  const searchInput = document.getElementById('appSearchInput');
  if (searchInput) searchInput.addEventListener('input', window.loadApplications);

  const statusFilter = document.getElementById('appStatusFilter');
  if (statusFilter) statusFilter.addEventListener('change', window.loadApplications);

  const shortlistSearch = document.getElementById('shortlistSearchInput');
  if (shortlistSearch) shortlistSearch.addEventListener('input', window.loadShortlist);
});
