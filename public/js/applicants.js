/**
 * TalentFlow Recruitment & Applicant Management System
 * Applicants Database & Candidate Profile Dossier Module
 */

let allApplicantsCache = [];

window.loadApplicants = async function () {
  const search = document.getElementById('applicantsSearchInput')?.value || '';
  const skills = document.getElementById('applicantsSkillsFilter')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (skills) params.append('skills', skills);

  const result = await apiFetch(`/api/applicants?${params.toString()}`);
  if (!result || !result.ok) return;

  allApplicantsCache = result.data.applicants || [];
  renderApplicantsTable(allApplicantsCache);
};

// Render Applicants Table
function renderApplicantsTable(applicants) {
  const tbody = document.getElementById('applicantsTableBody');
  const countBadge = document.getElementById('applicantsCountBadge');

  if (countBadge) {
    countBadge.textContent = `${applicants.length} Applicant${applicants.length === 1 ? '' : 's'}`;
  }

  if (!tbody) return;

  if (applicants.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">👤</div>
          <h3>No Candidates in Database</h3>
          <p>No applicant records match your criteria. As candidates submit applications, their profiles will populate here.</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = applicants.map(ap => {
    const skillsList = (ap.skills || '').split(',').map(s => s.trim()).filter(Boolean);
    const displayedSkills = skillsList.slice(0, 3);
    const remainingCount = skillsList.length - 3;

    return `
      <tr>
        <td>
          <div class="candidate-cell">
            <span class="candidate-name">${escapeHtml(ap.full_name)}</span>
            <span class="candidate-email">${escapeHtml(ap.email)}</span>
            <span class="candidate-phone">📞 ${escapeHtml(ap.phone)}</span>
          </div>
        </td>
        <td>
          <div style="font-size: 13.5px; color: var(--text-dark);">${escapeHtml(ap.education)}</div>
        </td>
        <td>
          <div style="max-width: 220px;">
            ${displayedSkills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
            ${remainingCount > 0 ? `<span class="skill-tag">+${remainingCount}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge badge-active">${ap.total_applications} Job${ap.total_applications === 1 ? '' : 's'}</span>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(ap.applied_jobs || '')}">
            ${escapeHtml(ap.applied_jobs || 'None')}
          </div>
        </td>
        <td>
          ${ap.latest_resume ? `
            <a href="/api/applications/resume/${encodeURIComponent(ap.latest_resume)}" target="_blank" class="btn btn-sm btn-outline-primary">
              📄 Resume PDF
            </a>
          ` : '<span style="color: var(--text-light); font-size: 12px;">No file</span>'}
        </td>
        <td>${formatDate(ap.created_at)}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-sm btn-outline-primary" title="View Full Profile Dossier" onclick="viewApplicantFullDossier(${ap.id})">
            👁️ Dossier
          </button>
          <button type="button" class="btn btn-sm btn-outline" title="Edit Applicant Info" onclick="openEditApplicantModal(${ap.id})">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-sm btn-danger btn-icon" title="Delete Applicant" onclick="deleteApplicant(${ap.id}, '${escapeHtml(ap.full_name)}')">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// View Full Dossier for an Applicant
window.viewApplicantFullDossier = async function (applicantId) {
  const result = await apiFetch(`/api/applicants/${applicantId}`);
  if (!result || !result.ok) {
    showToast('Failed to load candidate dossier.', 'error');
    return;
  }

  const { applicant, applications, interviews, resumes } = result.data;

  // Use applicantProfileModal to show full details
  document.getElementById('profileModalFullName').textContent = applicant.full_name;
  document.getElementById('profileModalEmail').textContent = applicant.email;
  document.getElementById('profileModalPhone').textContent = applicant.phone;
  document.getElementById('profileModalEducation').textContent = applicant.education;
  document.getElementById('profileModalExperience').textContent = applicant.experience;
  document.getElementById('profileModalJobTitle').textContent = `Candidate Dossier (#${applicant.id})`;
  document.getElementById('profileModalDept').textContent = `${applications.length} Total Application(s) on file`;
  document.getElementById('profileModalAppliedDate').textContent = formatDate(applicant.created_at);
  document.getElementById('profileModalStatusBadge').innerHTML = `<span class="badge badge-active">${applications.length} Applications</span>`;
  document.getElementById('profileModalCoverNote').textContent = `Applied to: ${applications.map(a => `${a.job_title} (${a.status})`).join(', ') || 'None'}`;
  document.getElementById('profileModalReviewNotes').textContent = `Candidate registered on ${formatDate(applicant.created_at)}.`;

  // Render skills tags
  const skillsContainer = document.getElementById('profileModalSkills');
  const skillsList = (applicant.skills || '').split(',').map(s => s.trim()).filter(Boolean);
  skillsContainer.innerHTML = skillsList.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');

  // Resumes
  const resumeContainer = document.getElementById('profileModalResumeAction');
  if (resumes && resumes.length > 0) {
    resumeContainer.innerHTML = resumes.map(r => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-alt); border-radius: var(--radius-md); margin-bottom: 6px;">
        <span style="font-weight: 600; font-size: 13px;">📄 ${escapeHtml(r.original_name)}</span>
        <a href="/api/applications/resume/${encodeURIComponent(r.file_name)}" target="_blank" class="btn btn-sm btn-primary">
          View PDF ↗
        </a>
      </div>
    `).join('');
  } else {
    resumeContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No resume on file.</p>';
  }

  // Interviews
  const interviewContainer = document.getElementById('profileModalInterviews');
  if (interviews && interviews.length > 0) {
    interviewContainer.innerHTML = interviews.map(i => `
      <div style="padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between;">
          <strong>${escapeHtml(i.interview_type)} - ${escapeHtml(i.job_title)}</strong>
          ${getStatusBadge(i.status)}
        </div>
        <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 4px;">
          📅 ${formatDate(i.interview_date)} at ${i.interview_time} • 📍 ${escapeHtml(i.location)}
        </div>
      </div>
    `).join('');
  } else {
    interviewContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No interviews scheduled.</p>';
  }

  openModal('applicantProfileModal');
};

// Open Edit Applicant Modal
window.openEditApplicantModal = function (applicantId) {
  const ap = allApplicantsCache.find(a => a.id === applicantId);
  if (!ap) return;

  document.getElementById('editApplicantId').value = ap.id;
  document.getElementById('editApplicantName').value = ap.full_name;
  document.getElementById('editApplicantEmail').value = ap.email;
  document.getElementById('editApplicantPhone').value = ap.phone;
  document.getElementById('editApplicantEducation').value = ap.education;
  document.getElementById('editApplicantSkills').value = ap.skills;
  document.getElementById('editApplicantExperience').value = ap.experience;

  openModal('editApplicantModal');
};

// Handle Edit Applicant Form Submit
async function handleEditApplicantSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('editApplicantId').value;
  const payload = {
    full_name: document.getElementById('editApplicantName').value.trim(),
    email: document.getElementById('editApplicantEmail').value.trim(),
    phone: document.getElementById('editApplicantPhone').value.trim(),
    education: document.getElementById('editApplicantEducation').value.trim(),
    skills: document.getElementById('editApplicantSkills').value.trim(),
    experience: document.getElementById('editApplicantExperience').value.trim()
  };

  const submitBtn = document.getElementById('saveEditApplicantSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const result = await apiFetch(`/api/applicants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Update Profile';

  if (result && result.ok) {
    showToast(result.data.message || 'Applicant profile updated.', 'success');
    closeModal('editApplicantModal');
    loadApplicants();
  } else {
    showToast(result?.data?.message || 'Failed to update applicant.', 'error');
  }
}

// Delete Applicant
function deleteApplicant(applicantId, fullName) {
  confirmAction({
    title: 'Delete Applicant?',
    message: `Are you sure you want to delete "${fullName}"? All their submitted applications, interview schedules, and resumes will be permanently removed.`,
    confirmText: 'Delete Applicant',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const result = await apiFetch(`/api/applicants/${applicantId}`, { method: 'DELETE' });
      if (result && result.ok) {
        showToast(result.data.message || 'Applicant deleted.', 'success');
        loadApplicants();
        if (window.loadDashboardStats) window.loadDashboardStats();
      } else {
        showToast(result?.data?.message || 'Failed to delete applicant.', 'error');
      }
    }
  });
}

// Attach listeners
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('editApplicantForm');
  if (form) form.addEventListener('submit', handleEditApplicantSubmit);

  const searchInput = document.getElementById('applicantsSearchInput');
  if (searchInput) searchInput.addEventListener('input', window.loadApplicants);

  const skillsFilter = document.getElementById('applicantsSkillsFilter');
  if (skillsFilter) skillsFilter.addEventListener('input', window.loadApplicants);
});
