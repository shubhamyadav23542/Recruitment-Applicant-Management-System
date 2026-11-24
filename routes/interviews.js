const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/database');
const { supabase } = require('../database/supabase');
const { authenticateAdmin } = require('../middleware/authMiddleware');

router.use(authenticateAdmin);

// GET /api/interviews - List interviews with filters
router.get('/', async (req, res) => {
  try {
    const { status, upcoming, search } = req.query;

    let query = `
      SELECT 
        i.*,
        a.job_id,
        a.applicant_id,
        a.status AS application_status,
        a.is_shortlisted,
        j.title AS job_title,
        j.department AS job_department,
        ap.full_name AS candidate_name,
        ap.email AS candidate_email,
        ap.phone AS candidate_phone
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN jobs j ON a.job_id = j.id
      JOIN applicants ap ON a.applicant_id = ap.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (upcoming === 'true') {
      query += ` AND (date(i.interview_date) >= date('now') AND i.status = 'Scheduled')`;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (ap.full_name LIKE ? OR ap.email LIKE ? OR j.title LIKE ? OR i.location LIKE ?)`;
      params.push(term, term, term, term);
    }

    query += ` ORDER BY i.interview_date ASC, i.interview_time ASC`;

    const interviews = await dbAsync.all(query, params);
    return res.json({ success: true, interviews });
  } catch (err) {
    console.error('Error fetching interviews:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve scheduled interviews.' });
  }
});

// POST /api/interviews - Schedule candidate interview (Stores in SQLite & Supabase)
router.post('/', async (req, res) => {
  try {
    const {
      application_id,
      interview_date,
      interview_time,
      location,
      interview_type,
      notes
    } = req.body;

    if (!application_id || !interview_date || !interview_time || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide application, interview date, interview time, and location.'
      });
    }

    const application = await dbAsync.get(
      `SELECT a.id, ap.full_name, j.title 
       FROM applications a
       JOIN applicants ap ON a.applicant_id = ap.id
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`,
      [application_id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application record not found.' });
    }

    // Insert locally in SQLite
    const result = await dbAsync.run(
      `INSERT INTO interviews (application_id, interview_date, interview_time, location, interview_type, status, notes)
       VALUES (?, ?, ?, ?, ?, 'Scheduled', ?)`,
      [
        application_id,
        interview_date.trim(),
        interview_time.trim(),
        location.trim(),
        interview_type ? interview_type.trim() : 'Technical Round',
        notes ? notes.trim() : ''
      ]
    );

    // Update application status to 'Interview Scheduled'
    await dbAsync.run(
      `UPDATE applications SET status = 'Interview Scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [application_id]
    );

    // Store in Supabase Cloud
    try {
      await supabase.from('interviews').upsert({
        id: result.lastID,
        application_id: parseInt(application_id, 10),
        interview_date: interview_date.trim(),
        interview_time: interview_time.trim(),
        location: location.trim(),
        interview_type: interview_type ? interview_type.trim() : 'Technical Round',
        status: 'Scheduled',
        notes: notes ? notes.trim() : ''
      });

      await supabase.from('applications').update({
        status: 'Interview Scheduled',
        updated_at: new Date().toISOString()
      }).eq('id', application_id);

      console.log(`✓ Interview #${result.lastID} stored in Supabase Cloud!`);
    } catch (sbErr) {
      console.error('Supabase interview insert warning:', sbErr.message);
    }

    const createdInterview = await dbAsync.get(
      `SELECT i.*, j.title AS job_title, ap.full_name AS candidate_name
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       JOIN applicants ap ON a.applicant_id = ap.id
       WHERE i.id = ?`,
      [result.lastID]
    );

    return res.status(201).json({
      success: true,
      message: `Interview scheduled for ${application.full_name}.`,
      interview: createdInterview
    });
  } catch (err) {
    console.error('Error scheduling interview:', err);
    return res.status(500).json({ success: false, message: 'Failed to schedule interview.' });
  }
});

// PUT /api/interviews/:id - Edit interview (Synced to Supabase)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      interview_date,
      interview_time,
      location,
      interview_type,
      status,
      notes
    } = req.body;

    const interview = await dbAsync.get('SELECT * FROM interviews WHERE id = ?', [id]);
    if (!interview) {
      return res.status(404).json({ success: false, message: 'Interview record not found.' });
    }

    const interviewStatus = status || interview.status;

    await dbAsync.run(
      `UPDATE interviews 
       SET interview_date = ?, interview_time = ?, location = ?, interview_type = ?, 
           status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        interview_date.trim(),
        interview_time.trim(),
        location.trim(),
        interview_type ? interview_type.trim() : interview.interview_type,
        interviewStatus,
        notes !== undefined ? notes.trim() : interview.notes,
        id
      ]
    );

    // Sync to Supabase
    try {
      await supabase.from('interviews').update({
        interview_date: interview_date.trim(),
        interview_time: interview_time.trim(),
        location: location.trim(),
        interview_type: interview_type ? interview_type.trim() : interview.interview_type,
        status: interviewStatus,
        notes: notes !== undefined ? notes.trim() : interview.notes,
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase interview update warning:', sbErr.message);
    }

    const updated = await dbAsync.get('SELECT * FROM interviews WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Interview updated successfully.',
      interview: updated
    });
  } catch (err) {
    console.error('Error updating interview:', err);
    return res.status(500).json({ success: false, message: 'Failed to update interview.' });
  }
});

// DELETE /api/interviews/:id - Cancel or delete interview (Synced to Supabase)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM interviews WHERE id = ?', [id]);

    try {
      await supabase.from('interviews').delete().eq('id', id);
    } catch (sbErr) {
      console.error('Supabase interview delete warning:', sbErr.message);
    }

    return res.json({ success: true, message: 'Interview deleted successfully.' });
  } catch (err) {
    console.error('Error deleting interview:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete interview.' });
  }
});

module.exports = router;
