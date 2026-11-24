const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/database');
const { supabase } = require('../database/supabase');
const { authenticateAdmin } = require('../middleware/authMiddleware');

router.use(authenticateAdmin);

// GET /api/applicants - List applicants
router.get('/', async (req, res) => {
  try {
    const { search, skills } = req.query;

    let query = `
      SELECT 
        ap.*,
        (SELECT COUNT(*) FROM applications WHERE applicant_id = ap.id) AS total_applications,
        (SELECT GROUP_CONCAT(j.title, ' | ') FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.applicant_id = ap.id) AS applied_jobs,
        (SELECT r.file_name FROM resumes r WHERE r.applicant_id = ap.id ORDER BY r.uploaded_at DESC LIMIT 1) AS latest_resume
      FROM applicants ap
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (ap.full_name LIKE ? OR ap.email LIKE ? OR ap.phone LIKE ?)`;
      params.push(term, term, term);
    }

    if (skills && skills.trim()) {
      query += ` AND ap.skills LIKE ?`;
      params.push(`%${skills.trim()}%`);
    }

    query += ` ORDER BY ap.created_at DESC`;

    const applicants = await dbAsync.all(query, params);
    return res.json({ success: true, applicants });
  } catch (err) {
    console.error('Error fetching applicants:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve applicants list.' });
  }
});

// GET /api/applicants/:id - View complete applicant profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const applicant = await dbAsync.get('SELECT * FROM applicants WHERE id = ?', [id]);
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }

    const applications = await dbAsync.all(
      `SELECT a.*, j.title AS job_title, j.department, j.location, j.job_type,
              r.file_name AS resume_file, r.original_name AS resume_original_name
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resumes r ON a.resume_id = r.id
       WHERE a.applicant_id = ?
       ORDER BY a.applied_at DESC`,
      [id]
    );

    const interviews = await dbAsync.all(
      `SELECT i.*, j.title AS job_title
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE a.applicant_id = ?
       ORDER BY i.interview_date DESC, i.interview_time DESC`,
      [id]
    );

    const resumes = await dbAsync.all(
      `SELECT * FROM resumes WHERE applicant_id = ? ORDER BY uploaded_at DESC`,
      [id]
    );

    return res.json({ success: true, applicant, applications, interviews, resumes });
  } catch (err) {
    console.error('Error fetching applicant profile:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve applicant profile.' });
  }
});

// PUT /api/applicants/:id - Edit applicant profile (Synced to Supabase)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, phone, education, skills, experience } = req.body;

    await dbAsync.run(
      `UPDATE applicants 
       SET full_name = ?, email = ?, phone = ?, education = ?, skills = ?, experience = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name.trim(), email.trim().toLowerCase(), phone.trim(), education.trim(), skills.trim(), experience.trim(), id]
    );

    // Sync to Supabase
    try {
      await supabase.from('applicants').update({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        education: education.trim(),
        skills: skills.trim(),
        experience: experience.trim(),
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase applicant update warning:', sbErr.message);
    }

    const updated = await dbAsync.get('SELECT * FROM applicants WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Applicant profile updated successfully.', applicant: updated });
  } catch (err) {
    console.error('Error updating applicant:', err);
    return res.status(500).json({ success: false, message: 'Failed to update applicant profile.' });
  }
});

// DELETE /api/applicants/:id - Delete applicant (Synced to Supabase)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM applicants WHERE id = ?', [id]);

    try {
      await supabase.from('applicants').delete().eq('id', id);
    } catch (sbErr) {
      console.error('Supabase applicant delete warning:', sbErr.message);
    }

    return res.json({ success: true, message: 'Applicant deleted successfully.' });
  } catch (err) {
    console.error('Error deleting applicant:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete applicant.' });
  }
});

module.exports = router;
