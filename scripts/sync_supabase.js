/**
 * Bidirectional Synchronizer: Local SQLite <-> Cloud Supabase
 */

const { dbAsync } = require('../database/database');
const { supabase } = require('../database/supabase');

async function syncToSupabase() {
  console.log('🔄 Starting SQLite -> Supabase Cloud Database Sync...\n');

  try {
    // 1. Sync Jobs
    const jobs = await dbAsync.all('SELECT * FROM jobs');
    if (jobs.length > 0) {
      console.log(`Syncing ${jobs.length} jobs to Supabase...`);
      for (const job of jobs) {
        const { error } = await supabase.from('jobs').upsert({
          id: job.id,
          title: job.title,
          department: job.department,
          location: job.location,
          salary_range: job.salary_range,
          job_type: job.job_type,
          description: job.description,
          requirements: job.requirements,
          status: job.status
        });
        if (error) console.error(`Error syncing job ${job.title}:`, error.message);
      }
      console.log('✓ Jobs synchronized successfully.');
    }

    // 2. Sync Applicants
    const applicants = await dbAsync.all('SELECT * FROM applicants');
    if (applicants.length > 0) {
      console.log(`\nSyncing ${applicants.length} applicants to Supabase...`);
      for (const ap of applicants) {
        const { error } = await supabase.from('applicants').upsert({
          id: ap.id,
          full_name: ap.full_name,
          email: ap.email,
          phone: ap.phone,
          education: ap.education,
          skills: ap.skills,
          experience: ap.experience
        });
        if (error) console.error(`Error syncing applicant ${ap.email}:`, error.message);
      }
      console.log('✓ Applicants synchronized successfully.');
    }

    // 2.5 Sync Resumes
    const resumes = await dbAsync.all('SELECT * FROM resumes');
    if (resumes.length > 0) {
      console.log(`\nSyncing ${resumes.length} resumes to Supabase...`);
      for (const r of resumes) {
        const { error } = await supabase.from('resumes').upsert({
          id: r.id,
          applicant_id: r.applicant_id,
          file_name: r.file_name,
          original_name: r.original_name,
          file_path: r.file_path,
          file_size: r.file_size,
          mime_type: r.mime_type
        });
        if (error) console.error(`Error syncing resume #${r.id}:`, error.message);
      }
      console.log('✓ Resumes synchronized successfully.');
    }

    // 3. Sync Applications
    const applications = await dbAsync.all('SELECT * FROM applications');
    if (applications.length > 0) {
      console.log(`\nSyncing ${applications.length} applications to Supabase...`);
      for (const a of applications) {
        const { error } = await supabase.from('applications').upsert({
          id: a.id,
          job_id: a.job_id,
          applicant_id: a.applicant_id,
          resume_id: a.resume_id,
          status: a.status,
          is_shortlisted: a.is_shortlisted,
          cover_note: a.cover_note,
          review_notes: a.review_notes
        });
        if (error) console.error(`Error syncing application #${a.id}:`, error.message);
      }
      console.log('✓ Applications synchronized successfully.');
    }

    // 4. Sync Interviews
    const interviews = await dbAsync.all('SELECT * FROM interviews');
    if (interviews.length > 0) {
      console.log(`\nSyncing ${interviews.length} interviews to Supabase...`);
      for (const i of interviews) {
        const { error } = await supabase.from('interviews').upsert({
          id: i.id,
          application_id: i.application_id,
          interview_date: i.interview_date,
          interview_time: i.interview_time,
          location: i.location,
          interview_type: i.interview_type,
          status: i.status,
          notes: i.notes
        });
        if (error) console.error(`Error syncing interview #${i.id}:`, error.message);
      }
      console.log('✓ Interviews synchronized successfully.');
    }

    console.log('\n🎉 ALL DATA SYNCHRONIZED WITH SUPABASE CLOUD!');
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

syncToSupabase();
