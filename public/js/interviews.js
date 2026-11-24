/**
 * HomiesLab SaaS HR Admin Panel UI
 * Interviews Scheduling & Calendar Module
 */

let allInterviewsCache = [];

window.loadInterviews = async function () {
  const search = document.getElementById('interviewsSearchInput')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);

  const result = await apiFetch(`/api/interviews?${params.toString()}`);
  if (!result || !result.ok) return;

  allInterviewsCache = result.data.interviews || [];
  renderInterviewsTable(allInterviewsCache);
};

// Render Interviews Table
function renderInterviewsTable(interviews) {
  const tbody = document.getElementById('interviewsTableBody');
  const countBadge = document.getElementById('interviewsCountBadge');

  if (countBadge) {
    countBadge.textContent = `${interviews.length} Scheduled`;
  }

  if (!tbody) return;

  if (interviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No interviews scheduled. Click "+ Schedule Interview" to add one.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = interviews.map(i => {
    const initial = (i.candidate_name || 'C').charAt(0).toUpperCase();

    return `
      <tr>
        <td>
          <div class="candidate-avatar-cell">
            <div class="avatar-circle">${initial}</div>
            <div>
              <div class="candidate-name-bold">${escapeHtml(i.candidate_name)}</div>
              <div class="candidate-sub-id">${escapeHtml(i.candidate_email)}</div>
            </div>
          </div>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 13.5px;">${escapeHtml(i.job_title)}</strong>
          <div style="font-size: 11.5px; color: var(--text-muted);">${escapeHtml(i.job_department)}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${formatDate(i.interview_date)}</div>
          <div style="font-size: 12px; color: #B78103; font-weight: 700;">⏰ ${escapeHtml(i.interview_time)}</div>
        </td>
        <td>
          <span class="badge-pill" style="background: var(--bg-card-subtle); color: var(--text-main); font-weight: 700;">${escapeHtml(i.interview_type)}</span>
        </td>
        <td>
          <div style="max-width: 220px; font-size: 12.5px; color: var(--text-main); word-break: break-all;">
            📍 ${escapeHtml(i.location)}
          </div>
        </td>
        <td>
          ${getStatusBadge(i.status)}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn-primary-yellow" style="padding: 4px 10px; font-size: 11px;" title="Edit" onclick="editInterview(${i.id})">
              Edit
            </button>
            ${i.status === 'Scheduled' ? `
              <button type="button" class="btn-primary-black" style="padding: 4px 10px; font-size: 11px;" title="Done" onclick="updateInterviewStatusQuick(${i.id}, 'Completed')">
                Done
              </button>
            ` : ''}
            <button type="button" class="icon-squircle-btn" style="width: 28px; height: 28px; font-size: 11px; color: #E53E3E;" onclick="deleteInterview(${i.id})">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Schedule Modal with specific application
window.quickScheduleInterview = async function (appId, candidateName, jobTitle) {
  await populateInterviewAppDropdown(appId);

  document.getElementById('interviewModalTitle').textContent = `Schedule: ${candidateName}`;
  document.getElementById('interviewForm').reset();
  document.getElementById('interviewId').value = '';
  document.getElementById('interviewAppId').value = appId;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('interviewDate').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('interviewTime').value = '10:00';
  document.getElementById('interviewLocation').value = 'Google Meet (meet.google.com/xyz)';
  document.getElementById('interviewType').value = 'Technical Round';

  openModal('interviewModal');
};

// Open Schedule Modal generic
window.openScheduleInterviewModal = async function () {
  await populateInterviewAppDropdown();

  document.getElementById('interviewModalTitle').textContent = 'Schedule Candidate Interview';
  document.getElementById('interviewForm').reset();
  document.getElementById('interviewId').value = '';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('interviewDate').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('interviewTime').value = '10:00';
  document.getElementById('interviewLocation').value = 'Google Meet (meet.google.com/xyz)';

  openModal('interviewModal');
};

// Populate the Application dropdown in the interview modal
async function populateInterviewAppDropdown(selectedAppId = null) {
  const select = document.getElementById('interviewAppId');
  if (!select) return;

  const res = await apiFetch('/api/applications');
  if (!res || !res.ok) return;

  const applications = res.data.applications || [];

  select.innerHTML = '<option value="">-- Choose Candidate Application --</option>' +
    applications.map(a => `
      <option value="${a.application_id}">
        ${escapeHtml(a.full_name)} - ${escapeHtml(a.job_title)} (${escapeHtml(a.status)})
      </option>
    `).join('');

  if (selectedAppId) select.value = selectedAppId;
}

// Open Edit Interview Modal
window.editInterview = function (interviewId) {
  const interview = allInterviewsCache.find(i => i.id === interviewId);
  if (!interview) return;

  document.getElementById('interviewModalTitle').textContent = `Edit Interview - ${interview.candidate_name}`;
  document.getElementById('interviewId').value = interview.id;

  populateInterviewAppDropdown(interview.application_id);

  document.getElementById('interviewDate').value = interview.interview_date;
  document.getElementById('interviewTime').value = interview.interview_time;
  document.getElementById('interviewLocation').value = interview.location;
  document.getElementById('interviewType').value = interview.interview_type;
  document.getElementById('interviewNotes').value = interview.notes || '';

  const statusGroup = document.getElementById('interviewStatusGroup');
  const statusSelect = document.getElementById('interviewStatusSelect');
  if (statusGroup && statusSelect) {
    statusGroup.style.display = 'block';
    statusSelect.value = interview.status;
  }

  openModal('interviewModal');
};

// Handle Interview Form Submit
async function handleInterviewFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('interviewId').value;
  const application_id = document.getElementById('interviewAppId').value;
  const interview_date = document.getElementById('interviewDate').value;
  const interview_time = document.getElementById('interviewTime').value;
  const location = document.getElementById('interviewLocation').value.trim();
  const interview_type = document.getElementById('interviewType').value;
  const notes = document.getElementById('interviewNotes').value.trim();
  const status = document.getElementById('interviewStatusSelect')?.value || 'Scheduled';

  if (!application_id || !interview_date || !interview_time || !location) {
    showToast('Please fill all required interview details.', 'error');
    return;
  }

  const isEdit = Boolean(id);
  const endpoint = isEdit ? `/api/interviews/${id}` : '/api/interviews';
  const method = isEdit ? 'PUT' : 'POST';

  const payload = { application_id, interview_date, interview_time, location, interview_type, notes, status };

  const submitBtn = document.getElementById('saveInterviewSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const result = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Save Interview';

  if (result && result.ok) {
    showToast(result.data.message || 'Interview saved successfully.', 'success');
    closeModal('interviewModal');
    loadInterviews();
    if (window.loadDashboardStats) window.loadDashboardStats();
  } else {
    showToast(result?.data?.message || 'Failed to schedule interview.', 'error');
  }
}

// Quick 1-click status update
async function updateInterviewStatusQuick(interviewId, newStatus) {
  const interview = allInterviewsCache.find(i => i.id === interviewId);
  if (!interview) return;

  const result = await apiFetch(`/api/interviews/${interviewId}`, {
    method: 'PUT',
    body: JSON.stringify({
      interview_date: interview.interview_date,
      interview_time: interview.interview_time,
      location: interview.location,
      interview_type: interview.interview_type,
      notes: interview.notes,
      status: newStatus
    })
  });

  if (result && result.ok) {
    showToast(`Interview marked as ${newStatus}.`, 'success');
    loadInterviews();
    if (window.loadDashboardStats) window.loadDashboardStats();
  } else {
    showToast(result?.data?.message || 'Error updating interview.', 'error');
  }
}

// Delete Interview
function deleteInterview(interviewId) {
  confirmAction({
    title: 'Delete Interview Record?',
    message: 'Are you sure you want to remove this scheduled interview?',
    onConfirm: async () => {
      const result = await apiFetch(`/api/interviews/${interviewId}`, { method: 'DELETE' });
      if (result && result.ok) {
        showToast('Interview deleted.', 'success');
        loadInterviews();
        if (window.loadDashboardStats) window.loadDashboardStats();
      } else {
        showToast(result?.data?.message || 'Failed to delete interview.', 'error');
      }
    }
  });
}

// Attach listeners
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('interviewForm');
  if (form) form.addEventListener('submit', handleInterviewFormSubmit);

  const search = document.getElementById('interviewsSearchInput');
  if (search) search.addEventListener('input', window.loadInterviews);
});
