const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/database');
const { authenticateCandidate } = require('../middleware/authMiddleware');

// GET /api/candidates/my-portal - Candidate Dashboard Data
router.get('/my-portal', authenticateCandidate, async (req, res) => {
  try {
    const candidateId = req.user.id;

    // 1. Get profile
    const candidate = await dbAsync.get(
      'SELECT id, full_name, email, phone, education, skills, experience, created_at FROM applicants WHERE id = ?',
      [candidateId]
    );

    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate account not found.' });
    }

    // 2. Get all applications filed by candidate
    const applications = await dbAsync.all(
      `SELECT 
         a.id as application_id,
         a.status,
         a.is_shortlisted,
         a.cover_note,
         a.applied_at,
         j.id as job_id,
         j.title as job_title,
         j.department,
         j.location,
         j.salary_range,
         j.job_type,
         r.id as resume_id,
         r.file_name,
         r.original_name,
         i.id as interview_id,
         i.interview_date,
         i.interview_time,
         i.location as interview_location,
         i.interview_type,
         i.status as interview_status,
         i.notes as interview_notes
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN resumes r ON a.resume_id = r.id
       LEFT JOIN interviews i ON i.application_id = a.id
       WHERE a.applicant_id = ?
       ORDER BY a.applied_at DESC`,
      [candidateId]
    );

    // 3. Get upcoming interviews specifically
    const interviews = await dbAsync.all(
      `SELECT 
         i.id,
         i.interview_date,
         i.interview_time,
         i.location,
         i.interview_type,
         i.status,
         i.notes,
         j.title as job_title,
         j.department
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE a.applicant_id = ? AND i.status != 'Cancelled'
       ORDER BY i.interview_date ASC, i.interview_time ASC`,
      [candidateId]
    );

    // 4. Calculate stats
    const stats = {
      total_applied: applications.length,
      shortlisted: applications.filter(a => a.status === 'Shortlisted' || a.is_shortlisted === 1).length,
      interviews_scheduled: applications.filter(a => a.status === 'Interview Scheduled' || a.interview_id).length,
      under_review: applications.filter(a => a.status === 'Under Review' || a.status === 'Pending').length
    };

    return res.json({
      success: true,
      candidate,
      stats,
      applications,
      interviews
    });
  } catch (err) {
    console.error('Candidate portal error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve candidate portal data.'
    });
  }
});

// PUT /api/candidates/profile - Update Candidate Profile
router.put('/profile', authenticateCandidate, async (req, res) => {
  try {
    const candidateId = req.user.id;
    const { full_name, phone, education, skills, experience } = req.body;

    await dbAsync.run(
      `UPDATE applicants 
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           education = COALESCE(?, education),
           skills = COALESCE(?, skills),
           experience = COALESCE(?, experience),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name, phone, education, skills, experience, candidateId]
    );

    const updated = await dbAsync.get(
      'SELECT id, full_name, email, phone, education, skills, experience FROM applicants WHERE id = ?',
      [candidateId]
    );

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      candidate: updated
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
});

module.exports = router;
