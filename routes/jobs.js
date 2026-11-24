const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/database');
const { supabase } = require('../database/supabase');
const { authenticateAdmin, optionalAuth } = require('../middleware/authMiddleware');

// GET /api/jobs/public - Available active jobs for candidate application form
router.get('/public', async (req, res) => {
  try {
    const jobs = await dbAsync.all(
      `SELECT id, title, department, location, salary_range, job_type, description, requirements, created_at 
       FROM jobs 
       WHERE status = 'Active' 
       ORDER BY created_at DESC`
    );
    return res.json({ success: true, jobs });
  } catch (err) {
    console.error('Error fetching public jobs:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve open job listings.' });
  }
});

// GET /api/jobs - View all jobs (with application stats)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, department, status } = req.query;
    let query = `
      SELECT j.*, 
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id) AS total_applicants,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'Pending') AS pending_count,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND is_shortlisted = 1) AS shortlisted_count,
        (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'Interview Scheduled') AS interview_count
      FROM jobs j
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (department && department !== 'All') {
      query += ` AND j.department = ?`;
      params.push(department);
    }

    if (status && status !== 'All') {
      query += ` AND j.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY j.created_at DESC`;

    const jobs = await dbAsync.all(query, params);
    return res.json({ success: true, jobs });
  } catch (err) {
    console.error('Error fetching jobs:', err);
    return res.status(500).json({ success: false, message: 'Failed to load jobs.' });
  }
});

// POST /api/jobs - Admin: add new job (Stores in SQLite & Supabase Cloud)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { title, department, location, salary_range, job_type, description, requirements, status } = req.body;

    if (!title || !department || !location || !salary_range || !job_type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required job fields.'
      });
    }

    const jobStatus = status === 'Closed' ? 'Closed' : 'Active';

    // Insert locally in SQLite
    const result = await dbAsync.run(
      `INSERT INTO jobs (title, department, location, salary_range, job_type, description, requirements, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        department.trim(),
        location.trim(),
        salary_range.trim(),
        job_type.trim(),
        description.trim(),
        requirements ? requirements.trim() : '',
        jobStatus
      ]
    );

    const newJob = await dbAsync.get('SELECT * FROM jobs WHERE id = ?', [result.lastID]);

    // Store in Supabase Cloud
    try {
      await supabase.from('jobs').upsert({
        id: result.lastID,
        title: title.trim(),
        department: department.trim(),
        location: location.trim(),
        salary_range: salary_range.trim(),
        job_type: job_type.trim(),
        description: description.trim(),
        requirements: requirements ? requirements.trim() : '',
        status: jobStatus
      });
      console.log(`✓ Job "${title}" stored in Supabase Cloud!`);
    } catch (sbErr) {
      console.error('Supabase job insert warning:', sbErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Job posting created successfully.',
      job: newJob
    });
  } catch (err) {
    console.error('Error creating job:', err);
    return res.status(500).json({ success: false, message: 'Failed to create job posting.' });
  }
});

// PUT /api/jobs/:id - Admin: edit existing job (Synced to Supabase)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, department, location, salary_range, job_type, description, requirements, status } = req.body;

    const jobStatus = status === 'Closed' ? 'Closed' : 'Active';

    await dbAsync.run(
      `UPDATE jobs 
       SET title = ?, department = ?, location = ?, salary_range = ?, job_type = ?, 
           description = ?, requirements = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title.trim(),
        department.trim(),
        location.trim(),
        salary_range.trim(),
        job_type.trim(),
        description.trim(),
        requirements ? requirements.trim() : '',
        jobStatus,
        id
      ]
    );

    const updatedJob = await dbAsync.get('SELECT * FROM jobs WHERE id = ?', [id]);

    // Update in Supabase
    try {
      await supabase.from('jobs').update({
        title: title.trim(),
        department: department.trim(),
        location: location.trim(),
        salary_range: salary_range.trim(),
        job_type: job_type.trim(),
        description: description.trim(),
        requirements: requirements ? requirements.trim() : '',
        status: jobStatus,
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase job update warning:', sbErr.message);
    }

    return res.json({
      success: true,
      message: 'Job posting updated successfully.',
      job: updatedJob
    });
  } catch (err) {
    console.error('Error updating job:', err);
    return res.status(500).json({ success: false, message: 'Failed to update job posting.' });
  }
});

// PATCH /api/jobs/:id/status - Admin: quick toggle status (Synced to Supabase)
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await dbAsync.run(
      'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    try {
      await supabase.from('jobs').update({
        status,
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase status warning:', sbErr.message);
    }

    return res.json({ success: true, message: `Job marked as ${status}.` });
  } catch (err) {
    console.error('Error updating status:', err);
    return res.status(500).json({ success: false, message: 'Failed to toggle job status.' });
  }
});

// DELETE /api/jobs/:id - Admin: delete job (Synced to Supabase)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const job = await dbAsync.get('SELECT id, title FROM jobs WHERE id = ?', [id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    await dbAsync.run('DELETE FROM jobs WHERE id = ?', [id]);

    try {
      await supabase.from('jobs').delete().eq('id', id);
    } catch (sbErr) {
      console.error('Supabase job delete warning:', sbErr.message);
    }

    return res.json({
      success: true,
      message: `Job "${job.title}" and its applications were deleted.`
    });
  } catch (err) {
    console.error('Error deleting job:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete job posting.' });
  }
});

module.exports = router;
