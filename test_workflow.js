/**
 * End-to-End Recruitment Workflow Automated Verification Test
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Test helper: create a small valid PDF file
const testPdfPath = path.join(__dirname, 'test_sample_resume.pdf');
const samplePdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (Candidate Resume) /Creator (TalentFlow ATS) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000085 00000 n \n0000000135 00000 n \n0000000194 00000 n \ntrailer\n<< /Size 5 /Root 2 0 R >>\nstartxref\n273\n%%EOF';
fs.writeFileSync(testPdfPath, samplePdfContent);

let authToken = '';
let createdJobId = null;
let createdAppId = null;
let createdInterviewId = null;
let resumeFileName = '';

function request(options, body = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object' && !isMultipart) {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING RECRUITMENT WORKFLOW E2E TEST ---');

  // 1. Admin Login
  console.log('\n[1] Testing Admin Login...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'admin@recruitment.com',
    password: 'admin123'
  });

  if (loginRes.status === 200 && loginRes.data.success && loginRes.data.token) {
    authToken = loginRes.data.token;
    console.log('✓ Admin Login PASSED. Token acquired.');
  } else {
    console.error('✕ Admin Login FAILED:', loginRes);
    process.exit(1);
  }

  // 2. Verify Session
  console.log('\n[2] Testing Auth Verification (/api/auth/me)...');
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (meRes.status === 200 && meRes.data.success) {
    console.log(`✓ Auth Me PASSED. Logged in as: ${meRes.data.admin.full_name} (${meRes.data.admin.email})`);
  } else {
    console.error('✕ Auth Me FAILED:', meRes);
    process.exit(1);
  }

  // 3. Create a Job Posting
  console.log('\n[3] Testing Job Creation (/api/jobs)...');
  const jobPayload = {
    title: 'Principal Cloud Infrastructure Engineer',
    department: 'Infrastructure',
    location: 'Bangalore, KA (Remote)',
    salary_range: '₹28,00,000 - ₹38,00,000 / year',
    job_type: 'Full-time',
    description: 'We are seeking an experienced Principal Cloud Infrastructure Engineer to lead our multi-region Kubernetes clusters.',
    requirements: '7+ years cloud infrastructure, Terraform, Kubernetes, AWS/GCP, Docker, high availability.',
    status: 'Active'
  };

  const createJobRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/jobs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, jobPayload);

  if (createJobRes.status === 201 && createJobRes.data.success) {
    createdJobId = createJobRes.data.job.id;
    console.log(`✓ Job Creation PASSED. Job ID: ${createdJobId} - "${createJobRes.data.job.title}"`);
  } else {
    console.error('✕ Job Creation FAILED:', createJobRes);
    process.exit(1);
  }

  // 4. Verify Public Jobs API
  console.log('\n[4] Testing Public Active Jobs Listing (/api/jobs/public)...');
  const publicJobsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/jobs/public',
    method: 'GET'
  });
  const foundJob = publicJobsRes.data.jobs.find(j => j.id === createdJobId);
  if (foundJob) {
    console.log(`✓ Public Jobs PASSED. Created job is visible on public careers portal.`);
  } else {
    console.error('✕ Public Jobs FAILED: Created job not found in public listing.');
    process.exit(1);
  }

  // 5. Submit Candidate Application with Resume Upload (Multipart Form Data)
  console.log('\n[5] Testing Candidate Application Submission with PDF Resume (/api/applications)...');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substring(2);
  const pdfBuffer = fs.readFileSync(testPdfPath);

  const fields = {
    job_id: createdJobId,
    full_name: 'David K. Morrison',
    email: 'david.morrison@example.com',
    phone: '+1 (555) 789-1234',
    education: 'M.S. in Distributed Computing - University of Washington',
    skills: 'Kubernetes, Go, Terraform, AWS, Docker, Python, Linux, PromQL',
    experience: '8 years leading cloud native platform infrastructure and site reliability engineering.',
    cover_note: 'Excited about scaling multi-tenant Kubernetes architecture at TalentFlow.'
  };

  let bodyParts = [];
  for (const [key, value] of Object.entries(fields)) {
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  // Add resume file
  bodyParts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="David_Morrison_Resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
  ));
  bodyParts.push(pdfBuffer);
  bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const multipartBody = Buffer.concat(bodyParts);

  const applyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/applications',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    }
  }, multipartBody, true);

  if (applyRes.status === 201 && applyRes.data.success) {
    createdAppId = applyRes.data.application_id;
    console.log(`✓ Application Submission PASSED. Application ID: ${createdAppId}`);
  } else {
    console.error('✕ Application Submission FAILED:', applyRes);
    process.exit(1);
  }

  // 6. Test Duplicate Application Prevention
  console.log('\n[6] Testing Duplicate Application Prevention...');
  const duplicateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/applications',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    }
  }, multipartBody, true);

  if (duplicateRes.status === 409 && !duplicateRes.data.success) {
    console.log(`✓ Duplicate Prevention PASSED. Server correctly blocked duplicate: "${duplicateRes.data.message}"`);
  } else {
    console.error('✕ Duplicate Prevention FAILED:', duplicateRes);
    process.exit(1);
  }

  // 7. Verify Application in Admin Listing
  console.log('\n[7] Testing Application Retrieval & Resume Link (/api/applications)...');
  const getAppRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/${createdAppId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (getAppRes.status === 200 && getAppRes.data.success) {
    const app = getAppRes.data.application;
    resumeFileName = app.resume_file;
    console.log(`✓ Application Details PASSED. Candidate: ${app.full_name}, Status: ${app.status}, Resume: ${resumeFileName}`);
  } else {
    console.error('✕ Application Details FAILED:', getAppRes);
    process.exit(1);
  }

  // 8. Test Resume Download
  console.log(`\n[8] Testing Resume Serving (/api/applications/resume/${resumeFileName})...`);
  const resumeRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/resume/${encodeURIComponent(resumeFileName)}`,
    method: 'GET'
  });
  if (resumeRes.status === 200 && resumeRes.headers['content-type'] === 'application/pdf') {
    console.log('✓ Resume PDF Serving PASSED. Content-Type is application/pdf.');
  } else {
    console.error('✕ Resume Serving FAILED:', resumeRes);
    process.exit(1);
  }

  // 9. Application Screening Status Update
  console.log('\n[9] Testing Application Screening Status Update (/api/applications/:id/status)...');
  const statusRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/${createdAppId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    status: 'Under Review',
    review_notes: 'Strong candidate with extensive Kubernetes production experience. Proceeding to shortlist.'
  });

  if (statusRes.status === 200 && statusRes.data.success && statusRes.data.status === 'Under Review') {
    console.log('✓ Status Screening PASSED. Status updated to "Under Review".');
  } else {
    console.error('✕ Status Screening FAILED:', statusRes);
    process.exit(1);
  }

  // 10. Shortlisting System
  console.log('\n[10] Testing Shortlisting System (/api/applications/:id/shortlist)...');
  const shortlistRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/${createdAppId}/shortlist`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    is_shortlisted: 1
  });

  if (shortlistRes.status === 200 && shortlistRes.data.is_shortlisted === 1) {
    console.log('✓ Shortlist PASSED. Candidate successfully added to shortlist.');
  } else {
    console.error('✕ Shortlist FAILED:', shortlistRes);
    process.exit(1);
  }

  // 11. Schedule Interview
  console.log('\n[11] Testing Interview Scheduling (/api/interviews)...');
  const interviewPayload = {
    application_id: createdAppId,
    interview_date: '2026-11-28',
    interview_time: '14:30',
    location: 'Google Meet: https://meet.google.com/xyz-infra-lead',
    interview_type: 'Technical Round',
    notes: 'In-depth assessment of Kubernetes multi-cluster networking, ingress controllers, and zero-trust service mesh.'
  };

  const scheduleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/interviews',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, interviewPayload);

  if (scheduleRes.status === 201 && scheduleRes.data.success) {
    createdInterviewId = scheduleRes.data.interview.id;
    console.log(`✓ Interview Scheduling PASSED. Interview ID: ${createdInterviewId} for date: ${scheduleRes.data.interview.interview_date}`);
  } else {
    console.error('✕ Interview Scheduling FAILED:', scheduleRes);
    process.exit(1);
  }

  // Verify application status automatically updated to 'Interview Scheduled'
  const verifyAppStatusRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/${createdAppId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  if (verifyAppStatusRes.data.application.status === 'Interview Scheduled') {
    console.log('✓ Automated Status Sync PASSED. Application status automatically synchronized to "Interview Scheduled".');
  } else {
    console.error('✕ Automated Status Sync FAILED:', verifyAppStatusRes.data);
    process.exit(1);
  }

  // 12. Mark Interview Completed
  console.log('\n[12] Testing Interview Status Update (Mark Completed)...');
  const completeInterviewRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/interviews/${createdInterviewId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    interview_date: '2026-11-28',
    interview_time: '14:30',
    location: 'Google Meet: https://meet.google.com/xyz-infra-lead',
    interview_type: 'Technical Round',
    notes: 'Exceeded all technical benchmarks. High recommend for hire.',
    status: 'Completed'
  });

  if (completeInterviewRes.status === 200 && completeInterviewRes.data.interview.status === 'Completed') {
    console.log('✓ Interview Completion PASSED. Interview marked as "Completed".');
  } else {
    console.error('✕ Interview Completion FAILED:', completeInterviewRes);
    process.exit(1);
  }

  // 13. Final Candidate Status: Selected
  console.log('\n[13] Testing Final Candidate Status Update to "Selected"...');
  const finalStatusRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/applications/${createdAppId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  }, {
    status: 'Selected',
    review_notes: 'Offer letter extended and accepted! Candidate hired for Principal Cloud Infrastructure Engineer.'
  });

  if (finalStatusRes.status === 200 && finalStatusRes.data.status === 'Selected') {
    console.log('✓ Final Candidate Decision PASSED. Status updated to "Selected".');
  } else {
    console.error('✕ Final Decision FAILED:', finalStatusRes);
    process.exit(1);
  }

  // 14. Verify Dashboard Statistics API
  console.log('\n[14] Testing Dashboard Statistics Calculation (/api/dashboard/stats)...');
  const dashboardRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/dashboard/stats',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (dashboardRes.status === 200 && dashboardRes.data.success) {
    const stats = dashboardRes.data.stats;
    console.log('✓ Dashboard Stats Calculation PASSED:');
    console.log(`   - Total Jobs: ${stats.total_jobs} (${stats.active_jobs} Active)`);
    console.log(`   - Total Applicants: ${stats.total_applicants}`);
    console.log(`   - Total Applications: ${stats.total_applications}`);
    console.log(`   - Shortlisted: ${stats.shortlisted_candidates}`);
    console.log(`   - Selected: ${stats.selected_candidates}`);
    console.log(`   - Scheduled Interviews: ${stats.scheduled_interviews}`);
  } else {
    console.error('✕ Dashboard Stats FAILED:', dashboardRes);
    process.exit(1);
  }

  // 15. Verify Candidate Database Dossier
  console.log('\n[15] Testing Candidate Dossier Retrieval (/api/applicants)...');
  const applicantsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/applicants',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  if (applicantsRes.status === 200 && applicantsRes.data.success) {
    const candidate = applicantsRes.data.applicants.find(a => a.email === 'david.morrison@example.com');
    if (candidate) {
      console.log(`✓ Candidate Database PASSED. Found candidate ${candidate.full_name} with ${candidate.total_applications} application(s).`);
    } else {
      console.error('✕ Candidate Database FAILED: Candidate not found.');
      process.exit(1);
    }
  }

  // Clean up test file
  if (fs.existsSync(testPdfPath)) {
    fs.unlinkSync(testPdfPath);
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL RECRUITMENT WORKFLOW TESTS COMPLETED SUCCESSFULLY! 🎉');
  console.log('Job Creation → Application Submission → Resume Upload → Screening → Shortlisting → Interview Scheduling → Final Status (Selected)');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
