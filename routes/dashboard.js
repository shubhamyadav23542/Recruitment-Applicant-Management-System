const express = require('express');
const router = express.Router();
const { dbAsync } = require('../database/database');
const { optionalAuth } = require('../middleware/authMiddleware');

// GET /api/dashboard/stats - Recruitment statistics and funnel data (Accessible for dashboard view)
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    // 1. Basic counts
    const totalJobsRow = await dbAsync.get('SELECT COUNT(*) as count FROM jobs');
    const activeJobsRow = await dbAsync.get("SELECT COUNT(*) as count FROM jobs WHERE status = 'Active'");
    const totalApplicantsRow = await dbAsync.get('SELECT COUNT(*) as count FROM applicants');
    const totalApplicationsRow = await dbAsync.get('SELECT COUNT(*) as count FROM applications');
    const pendingRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status = 'Pending'");
    const underReviewRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status = 'Under Review'");
    const shortlistedRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE is_shortlisted = 1 OR status = 'Shortlisted'");
    const interviewScheduledRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status = 'Interview Scheduled'");
    const selectedRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status = 'Selected'");
    const rejectedRow = await dbAsync.get("SELECT COUNT(*) as count FROM applications WHERE status = 'Rejected'");
    const scheduledInterviewsRow = await dbAsync.get("SELECT COUNT(*) as count FROM interviews WHERE status = 'Scheduled'");

    // 2. Department distribution
    const departmentDistribution = await dbAsync.all(`
      SELECT j.department, 
             COUNT(DISTINCT j.id) AS job_count, 
             COUNT(a.id) AS application_count
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      GROUP BY j.department
      ORDER BY application_count DESC
    `);

    // 3. Pipeline funnel
    const pipelineFunnel = [
      { stage: 'Pending', count: pendingRow ? pendingRow.count : 0, color: '#f59e0b' },
      { stage: 'Under Review', count: underReviewRow ? underReviewRow.count : 0, color: '#3b82f6' },
      { stage: 'Shortlisted', count: shortlistedRow ? shortlistedRow.count : 0, color: '#8b5cf6' },
      { stage: 'Interview Scheduled', count: interviewScheduledRow ? interviewScheduledRow.count : 0, color: '#06b6d4' },
      { stage: 'Selected', count: selectedRow ? selectedRow.count : 0, color: '#10b981' },
      { stage: 'Rejected', count: rejectedRow ? rejectedRow.count : 0, color: '#ef4444' }
    ];

    // 4. Recent applications (latest 6)
    const recentApplications = await dbAsync.all(`
      SELECT 
        a.id AS application_id,
        a.status,
        a.is_shortlisted,
        a.applied_at,
        ap.full_name,
        ap.email,
        j.title AS job_title,
        j.department
      FROM applications a
      JOIN applicants ap ON a.applicant_id = ap.id
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.applied_at DESC
      LIMIT 6
    `);

    // 5. Upcoming scheduled interviews (next 5)
    const upcomingInterviews = await dbAsync.all(`
      SELECT 
        i.id,
        i.interview_date,
        i.interview_time,
        i.location,
        i.interview_type,
        i.status,
        ap.full_name AS candidate_name,
        ap.email AS candidate_email,
        j.title AS job_title
      FROM interviews i
      JOIN applications a ON i.application_id = a.id
      JOIN applicants ap ON a.applicant_id = ap.id
      JOIN jobs j ON a.job_id = j.id
      WHERE i.status = 'Scheduled' AND date(i.interview_date) >= date('now')
      ORDER BY i.interview_date ASC, i.interview_time ASC
      LIMIT 5
    `);

    return res.json({
      success: true,
      stats: {
        total_jobs: totalJobsRow ? totalJobsRow.count : 0,
        active_jobs: activeJobsRow ? activeJobsRow.count : 0,
        total_applicants: totalApplicantsRow ? totalApplicantsRow.count : 0,
        total_applications: totalApplicationsRow ? totalApplicationsRow.count : 0,
        pending_applications: pendingRow ? pendingRow.count : 0,
        under_review_applications: underReviewRow ? underReviewRow.count : 0,
        shortlisted_candidates: shortlistedRow ? shortlistedRow.count : 0,
        interview_scheduled: interviewScheduledRow ? interviewScheduledRow.count : 0,
        selected_candidates: selectedRow ? selectedRow.count : 0,
        rejected_candidates: rejectedRow ? rejectedRow.count : 0,
        scheduled_interviews: scheduledInterviewsRow ? scheduledInterviewsRow.count : 0
      },
      departmentDistribution,
      pipelineFunnel,
      recentApplications,
      upcomingInterviews
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve recruitment statistics.' });
  }
});

module.exports = router;
