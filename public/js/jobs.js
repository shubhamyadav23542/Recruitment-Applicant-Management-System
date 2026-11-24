/**
 * HomiesLab SaaS HR Admin Panel UI
 * Jobs Management Module
 */

let allJobsCache = [];

window.loadJobs = async function () {
  const search = document.getElementById('jobsSearchInput')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);

  const result = await apiFetch(`/api/jobs?${params.toString()}`);
  if (!result || !result.ok) return;

  allJobsCache = result.data.jobs || [];
  APP_STATE.jobsList = allJobsCache;

  renderJobsTable(allJobsCache);
};

// Render Jobs Table
function renderJobsTable(jobs) {
  const tbody = document.getElementById('jobsTableBody');
  const countEl = document.getElementById('jobsCountBadge');
  if (countEl) countEl.textContent = `${jobs.length} Active Openings`;

  if (!tbody) return;

  if (jobs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
          No job postings found. Click "+ Create New Job" to post an opening.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = jobs.map(job => `
    <tr>
      <td>
        <div style="font-weight: 800; color: var(--text-main); font-size: 14px;">${escapeHtml(job.title)}</div>
        <div style="font-size: 11.5px; color: var(--text-muted); display: flex; gap: 8px; margin-top: 2px;">
          <span>🏷️ ${escapeHtml(job.job_type)}</span>
          <span>📍 ${escapeHtml(job.location)}</span>
        </div>
      </td>
      <td>
        <span class="badge-pill" style="background: var(--bg-card-subtle); color: var(--text-main);">${escapeHtml(job.department)}</span>
      </td>
      <td>
        <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(job.salary_range)}</strong>
      </td>
      <td>
        ${getStatusBadge(job.status)}
      </td>
      <td>
        <div style="font-weight: 800; font-size: 13.5px;">${job.total_applicants}</div>
        <div style="font-size: 11px; color: var(--text-muted);">
          ${job.pending_count} pending • ${job.shortlisted_count} shortlisted
        </div>
      </td>
      <td><span style="font-size: 12.5px; color: var(--text-muted);">${formatDate(job.created_at)}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn-primary-yellow" style="padding: 5px 12px; font-size: 11.5px;" onclick="editJob(${job.id})">
            Edit
          </button>
          <button type="button" class="btn-primary-black" style="padding: 5px 12px; font-size: 11.5px;" onclick="toggleJobStatus(${job.id}, '${job.status === 'Active' ? 'Closed' : 'Active'}')">
            ${job.status === 'Active' ? 'Close' : 'Activate'}
          </button>
          <button type="button" class="icon-squircle-btn" style="width: 30px; height: 30px; font-size: 12px; color: #E53E3E;" onclick="deleteJob(${job.id}, '${escapeHtml(job.title)}')">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Open Job Modal for Create
function openJobModal() {
  document.getElementById('jobModalTitle').textContent = 'Create New Job Posting';
  document.getElementById('jobForm').reset();
  document.getElementById('jobId').value = '';
  document.getElementById('jobStatus').value = 'Active';
  openModal('jobModal');
}

// Open Job Modal for Edit
function editJob(jobId) {
  const job = allJobsCache.find(j => j.id === jobId);
  if (!job) return;

  document.getElementById('jobModalTitle').textContent = 'Edit Job Posting';
  document.getElementById('jobId').value = job.id;
  document.getElementById('jobTitle').value = job.title;
  document.getElementById('jobDepartment').value = job.department;
  document.getElementById('jobLocation').value = job.location;
  document.getElementById('jobSalary').value = job.salary_range;
  document.getElementById('jobType').value = job.job_type;
  document.getElementById('jobStatus').value = job.status;
  document.getElementById('jobDescription').value = job.description;
  document.getElementById('jobRequirements').value = job.requirements || '';

  openModal('jobModal');
}

// Save Job (POST or PUT)
async function handleJobFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('jobId').value;
  const payload = {
    title: document.getElementById('jobTitle').value.trim(),
    department: document.getElementById('jobDepartment').value.trim(),
    location: document.getElementById('jobLocation').value.trim(),
    salary_range: document.getElementById('jobSalary').value.trim(),
    job_type: document.getElementById('jobType').value,
    status: document.getElementById('jobStatus').value,
    description: document.getElementById('jobDescription').value.trim(),
    requirements: document.getElementById('jobRequirements').value.trim()
  };

  const isEdit = Boolean(id);
  const endpoint = isEdit ? `/api/jobs/${id}` : '/api/jobs';
  const method = isEdit ? 'PUT' : 'POST';

  const submitBtn = document.getElementById('saveJobSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const result = await apiFetch(endpoint, {
    method,
    body: JSON.stringify(payload)
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Save Job Posting';

  if (result && result.ok) {
    showToast(result.data.message || 'Job saved successfully.', 'success');
    closeModal('jobModal');
    loadJobs();
  } else {
    showToast(result?.data?.message || 'Failed to save job.', 'error');
  }
}

// Toggle Job Status
async function toggleJobStatus(jobId, newStatus) {
  const result = await apiFetch(`/api/jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus })
  });

  if (result && result.ok) {
    showToast(result.data.message || `Job status updated to ${newStatus}.`, 'success');
    loadJobs();
  } else {
    showToast(result?.data?.message || 'Error updating status.', 'error');
  }
}

// Delete Job
function deleteJob(jobId, jobTitle) {
  confirmAction({
    title: 'Delete Job Posting?',
    message: `Are you sure you want to delete "${jobTitle}"? All associated applicant submissions will also be permanently removed.`,
    onConfirm: async () => {
      const result = await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (result && result.ok) {
        showToast(result.data.message || 'Job deleted successfully.', 'success');
        loadJobs();
      } else {
        showToast(result?.data?.message || 'Failed to delete job.', 'error');
      }
    }
  });
}

// Attach listeners on load
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('jobForm');
  if (form) form.addEventListener('submit', handleJobFormSubmit);

  const searchInput = document.getElementById('jobsSearchInput');
  if (searchInput) searchInput.addEventListener('input', window.loadJobs);
});
