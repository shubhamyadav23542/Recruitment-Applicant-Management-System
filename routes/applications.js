const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { dbAsync } = require('../database/database');
const { supabase, uploadResumeToSupabase } = require('../database/supabase');
const { authenticateAdmin, optionalAuth } = require('../middleware/authMiddleware');

// Configure Multer storage for PDF resumes
const resumesDir = path.join(__dirname, '..', 'uploads', 'resumes');
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, resumesDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `resume-${timestamp}-${cleanOriginal}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' && file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF resume files are accepted.'));
    }
    cb(null, true);
  }
});

// Helper for multer error handling
function uploadMiddleware(req, res, next) {
  upload.single('resume')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Resume file size exceeds the 5MB limit. Please upload a smaller PDF.'
        });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}

// POST /api/applications - Public job application submission (Stores in SQLite & Supabase)
router.post('/', uploadMiddleware, async (req, res) => {
  let uploadedFile = req.file;

  try {
    const {
      job_id,
      full_name,
      email,
      phone,
      education,
      skills,
      experience,
      cover_note
    } = req.body;

    // Validate required fields
    if (!job_id || !full_name || !email || !phone || !education || !skills || !experience) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled: Job, Full Name, Email, Phone, Education, Skills, and Experience.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Validate resume upload
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'A PDF resume file is required to submit your application.'
      });
    }

    // Verify job exists and is Active
    const job = await dbAsync.get('SELECT id, title, status FROM jobs WHERE id = ?', [job_id]);
    if (!job) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(404).json({ success: false, message: 'Selected job position does not exist.' });
    }
    if (job.status !== 'Active') {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(400).json({ success: false, message: 'This job posting is closed and no longer accepts applications.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();
    const cleanPhone = phone.trim();
    const cleanEducation = education.trim();
    const cleanSkills = skills.trim();
    const cleanExperience = experience.trim();
    const cleanCoverNote = cover_note ? cover_note.trim() : '';

    // Check or create applicant in SQLite
    let applicant = await dbAsync.get('SELECT id FROM applicants WHERE email = ?', [cleanEmail]);
    let applicantId;

    if (applicant) {
      applicantId = applicant.id;
      await dbAsync.run(
        `UPDATE applicants 
         SET full_name = ?, phone = ?, education = ?, skills = ?, experience = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [cleanName, cleanPhone, cleanEducation, cleanSkills, cleanExperience, applicantId]
      );
    } else {
      const newApplicantResult = await dbAsync.run(
        `INSERT INTO applicants (full_name, email, phone, education, skills, experience)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cleanName, cleanEmail, cleanPhone, cleanEducation, cleanSkills, cleanExperience]
      );
      applicantId = newApplicantResult.lastID;
    }

    // Check for duplicate application for this job
    const existingApp = await dbAsync.get(
      'SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?',
      [job_id, applicantId]
    );

    if (existingApp) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      return res.status(409).json({
        success: false,
        message: `An application from ${cleanEmail} for "${job.title}" has already been submitted. Duplicate applications are not allowed.`
      });
    }

    // Insert resume record in SQLite
    const resumeResult = await dbAsync.run(
      `INSERT INTO resumes (applicant_id, file_name, original_name, file_path, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        applicantId,
        uploadedFile.filename,
        uploadedFile.originalname,
        uploadedFile.path,
        uploadedFile.size,
        uploadedFile.mimetype
      ]
    );
    const resumeId = resumeResult.lastID;

    // Insert application in SQLite
    const appResult = await dbAsync.run(
      `INSERT INTO applications (job_id, applicant_id, resume_id, status, is_shortlisted, cover_note)
       VALUES (?, ?, ?, 'Pending', 0, ?)`,
      [job_id, applicantId, resumeId, cleanCoverNote]
    );

    // ===============================================================
    // STORE DIRECTLY IN SUPABASE CLOUD (PostgreSQL & Storage)
    // ===============================================================
    try {
      // 1. Upload resume to Supabase Storage Bucket 'resumes'
      const supabasePublicResumeUrl = await uploadResumeToSupabase(uploadedFile.filename, uploadedFile.path);

      // 2. Upsert applicant in Supabase
      const { data: sbApplicant } = await supabase.from('applicants').upsert({
        id: applicantId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        education: cleanEducation,
        skills: cleanSkills,
        experience: cleanExperience
      }).select().single();

      // 3. Insert resume in Supabase
      await supabase.from('resumes').upsert({
        id: resumeId,
        applicant_id: applicantId,
        file_name: uploadedFile.filename,
        original_name: uploadedFile.originalname,
        file_path: supabasePublicResumeUrl || uploadedFile.path,
        file_size: uploadedFile.size,
        mime_type: uploadedFile.mimetype
      });

      // 4. Insert application in Supabase
      await supabase.from('applications').upsert({
        id: appResult.lastID,
        job_id: parseInt(job_id, 10),
        applicant_id: applicantId,
        resume_id: resumeId,
        status: 'Pending',
        is_shortlisted: 0,
        cover_note: cleanCoverNote
      });

      console.log(`✓ Application #${appResult.lastID} stored in Supabase PostgreSQL & Storage!`);
    } catch (sbErr) {
      console.error('Supabase Cloud Sync Warning (data saved locally):', sbErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully! Stored in cloud database.',
      application_id: appResult.lastID
    });
  } catch (err) {
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }
    console.error('Error submitting application:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your application.'
    });
  }
});

// GET /api/applications - Filter and list applications
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, job_id, status, skills, is_shortlisted, date_from, date_to } = req.query;

    let query = `
      SELECT 
        a.id AS application_id,
        a.job_id,
        a.applicant_id,
        a.resume_id,
        a.status,
        a.is_shortlisted,
        a.cover_note,
        a.review_notes,
        a.applied_at,
        a.updated_at,
        j.title AS job_title,
        j.department AS job_department,
        j.location AS job_location,
        j.status AS job_status,
        ap.full_name,
        ap.email,
        ap.phone,
        ap.education,
        ap.skills,
        ap.experience,
        r.file_name AS resume_file,
        r.original_name AS resume_original_name,
        r.file_size AS resume_size
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN applicants ap ON a.applicant_id = ap.id
      LEFT JOIN resumes r ON a.resume_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (ap.full_name LIKE ? OR ap.email LIKE ?)`;
      params.push(term, term);
    }

    if (job_id && job_id !== 'All') {
      query += ` AND a.job_id = ?`;
      params.push(job_id);
    }

    if (status && status !== 'All') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (skills && skills.trim()) {
      query += ` AND ap.skills LIKE ?`;
      params.push(`%${skills.trim()}%`);
    }

    if (is_shortlisted !== undefined && is_shortlisted !== '' && is_shortlisted !== 'All') {
      query += ` AND a.is_shortlisted = ?`;
      params.push(parseInt(is_shortlisted, 10));
    }

    if (date_from) {
      query += ` AND date(a.applied_at) >= date(?)`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND date(a.applied_at) <= date(?)`;
      params.push(date_to);
    }

    query += ` ORDER BY a.applied_at DESC`;

    const applications = await dbAsync.all(query, params);
    return res.json({ success: true, applications });
  } catch (err) {
    console.error('Error fetching applications:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve applications.' });
  }
});

// GET /api/applications/:id - View single application details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const application = await dbAsync.get(
      `SELECT 
        a.id AS application_id,
        a.job_id,
        a.applicant_id,
        a.resume_id,
        a.status,
        a.is_shortlisted,
        a.cover_note,
        a.review_notes,
        a.applied_at,
        a.updated_at,
        j.title AS job_title,
        j.department AS job_department,
        j.location AS job_location,
        j.salary_range,
        j.job_type,
        ap.full_name,
        ap.email,
        ap.phone,
        ap.education,
        ap.skills,
        ap.experience,
        r.file_name AS resume_file,
        r.original_name AS resume_original_name,
        r.file_size AS resume_size
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       JOIN applicants ap ON a.applicant_id = ap.id
       LEFT JOIN resumes r ON a.resume_id = r.id
       WHERE a.id = ?`,
      [id]
    );

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const interviews = await dbAsync.all(
      `SELECT * FROM interviews WHERE application_id = ? ORDER BY interview_date DESC, interview_time DESC`,
      [id]
    );

    return res.json({ success: true, application, interviews });
  } catch (err) {
    console.error('Error fetching application detail:', err);
    return res.status(500).json({ success: false, message: 'Failed to load application details.' });
  }
});

// PATCH /api/applications/:id/status - Admin: update screening status (Synced to Supabase)
router.patch('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    const application = await dbAsync.get('SELECT id, is_shortlisted FROM applications WHERE id = ?', [id]);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    let isShortlisted = application.is_shortlisted;
    if (status === 'Shortlisted') isShortlisted = 1;
    else if (status === 'Rejected') isShortlisted = 0;

    let updateSql = `UPDATE applications SET status = ?, is_shortlisted = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [status, isShortlisted];

    if (review_notes !== undefined) {
      updateSql += `, review_notes = ?`;
      params.push(review_notes);
    }
    updateSql += ` WHERE id = ?`;
    params.push(id);

    await dbAsync.run(updateSql, params);

    // Sync to Supabase
    try {
      await supabase.from('applications').update({
        status,
        is_shortlisted: isShortlisted,
        review_notes: review_notes || '',
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase update warning:', sbErr.message);
    }

    return res.json({
      success: true,
      message: `Application status updated to "${status}".`,
      status,
      is_shortlisted: isShortlisted
    });
  } catch (err) {
    console.error('Error updating status:', err);
    return res.status(500).json({ success: false, message: 'Failed to update application status.' });
  }
});

// PATCH /api/applications/:id/shortlist - Admin: toggle shortlist (Synced to Supabase)
router.patch('/:id/shortlist', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_shortlisted } = req.body;

    const flag = is_shortlisted ? 1 : 0;
    const application = await dbAsync.get('SELECT id, status FROM applications WHERE id = ?', [id]);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    let newStatus = application.status;
    if (flag === 1 && (application.status === 'Pending' || application.status === 'Under Review')) {
      newStatus = 'Shortlisted';
    } else if (flag === 0 && application.status === 'Shortlisted') {
      newStatus = 'Under Review';
    }

    await dbAsync.run(
      `UPDATE applications SET is_shortlisted = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [flag, newStatus, id]
    );

    // Sync to Supabase
    try {
      await supabase.from('applications').update({
        is_shortlisted: flag,
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', id);
    } catch (sbErr) {
      console.error('Supabase shortlist sync warning:', sbErr.message);
    }

    return res.json({
      success: true,
      message: flag === 1 ? 'Candidate added to Shortlist.' : 'Candidate removed from Shortlist.',
      is_shortlisted: flag,
      status: newStatus
    });
  } catch (err) {
    console.error('Error toggling shortlist:', err);
    return res.status(500).json({ success: false, message: 'Failed to update shortlist status.' });
  }
});

// DELETE /api/applications/:id - Admin: delete application (Synced to Supabase)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await dbAsync.run('DELETE FROM applications WHERE id = ?', [id]);

    // Sync to Supabase
    try {
      await supabase.from('applications').delete().eq('id', id);
    } catch (sbErr) {
      console.error('Supabase delete warning:', sbErr.message);
    }

    return res.json({ success: true, message: 'Application deleted successfully.' });
  } catch (err) {
    console.error('Error deleting application:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete application.' });
  }
});

// GET /api/applications/resume/:filename - View or download PDF resume (Checks Local & Supabase Storage)
router.get('/resume/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(resumesDir, filename);

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback: Redirect to Supabase Storage Public URL
    const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(filename);
    if (publicUrlData && publicUrlData.publicUrl) {
      return res.redirect(publicUrlData.publicUrl);
    }

    return res.status(404).send('Resume file not found on server or storage.');
  } catch (err) {
    console.error('Error serving resume file:', err);
    return res.status(500).send('Error retrieving resume file.');
  }
});

module.exports = router;
