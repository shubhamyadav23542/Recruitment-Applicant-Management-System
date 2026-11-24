const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'recruitment.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('SQLite database opened at:', dbPath);
  }
});

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON;');

// Helper promise wrappers for SQLite
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  },
  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },
  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  },
  exec: (sql) => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
};

// Initialize schema and seed data
async function initializeDatabase() {
  try {
    // 1. Admins table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'Administrator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Jobs table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        department TEXT NOT NULL,
        location TEXT NOT NULL,
        salary_range TEXT NOT NULL,
        job_type TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT,
        status TEXT CHECK(status IN ('Active', 'Closed')) DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Applicants table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS applicants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        education TEXT NOT NULL,
        skills TEXT NOT NULL,
        experience TEXT NOT NULL,
        password_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration helper: Ensure password_hash column exists on existing applicants table
    try {
      await dbAsync.exec(`ALTER TABLE applicants ADD COLUMN password_hash TEXT;`);
    } catch (e) {
      // Column already exists, safe to ignore
    }

    // 4. Resumes table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      );
    `);

    // 5. Applications table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        applicant_id INTEGER NOT NULL,
        resume_id INTEGER,
        status TEXT CHECK(status IN ('Pending', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected')) DEFAULT 'Pending',
        is_shortlisted INTEGER DEFAULT 0,
        cover_note TEXT,
        review_notes TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
        FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE SET NULL,
        UNIQUE (job_id, applicant_id)
      );
    `);

    // 6. Interviews table
    await dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        interview_date TEXT NOT NULL,
        interview_time TEXT NOT NULL,
        location TEXT NOT NULL,
        interview_type TEXT DEFAULT 'Technical Round',
        status TEXT CHECK(status IN ('Scheduled', 'Completed', 'Cancelled', 'Rescheduled')) DEFAULT 'Scheduled',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      );
    `);

    // Seed default admin if none exists
    const adminCount = await dbAsync.get('SELECT COUNT(*) as count FROM admins');
    if (!adminCount || adminCount.count === 0) {
      const defaultPassword = 'admin123';
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(defaultPassword, salt);
      await dbAsync.run(
        `INSERT INTO admins (username, email, password_hash, full_name, role)
         VALUES (?, ?, ?, ?, ?)`,
        ['admin', 'admin@recruitment.com', hash, 'Lead HR Administrator', 'Administrator']
      );
      console.log('Default admin seeded: admin@recruitment.com / admin123');
    }

    // Seed default demo candidate if none exists
    let candidateUser = await dbAsync.get('SELECT * FROM applicants WHERE email = ?', ['candidate@example.com']);
    if (!candidateUser) {
      const candidatePassword = 'candidate123';
      const cSalt = bcrypt.genSaltSync(10);
      const cHash = bcrypt.hashSync(candidatePassword, cSalt);
      const candResult = await dbAsync.run(
        `INSERT INTO applicants (full_name, email, phone, education, skills, experience, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'Aarav Sharma',
          'candidate@example.com',
          '+91 98765 43210',
          'B.Tech in Computer Science - IIT Bombay (2022)',
          'JavaScript, Node.js, Express, React, PostgreSQL, Docker',
          '2+ years building scalable SaaS web platforms and cloud APIs.',
          cHash
        ]
      );
      console.log('Default demo candidate seeded: candidate@example.com / candidate123');

      // Link Aarav to an application
      const firstJob = await dbAsync.get('SELECT id FROM jobs LIMIT 1');
      if (firstJob) {
        const appRes = await dbAsync.run(
          `INSERT INTO applications (job_id, applicant_id, status, is_shortlisted, cover_note, review_notes)
           VALUES (?, ?, 'Interview Scheduled', 1, ?, ?)`,
          [
            firstJob.id,
            candResult.lastID,
            'Passionate about full-stack architectures and modern JavaScript.',
            'Exceptional candidate profile, scheduled for technical system round.'
          ]
        );

        // Schedule an interview
        await dbAsync.run(
          `INSERT INTO interviews (application_id, interview_date, interview_time, location, interview_type, status, notes)
           VALUES (?, '2026-11-28', '11:30 AM', 'Google Meet: meet.google.com/xyz-homies-lab', 'Technical System Design', 'Scheduled', ?)`,
          [
            appRes.lastID,
            'Discussion on REST APIs, database schemas, and Node.js performance.'
          ]
        );
      }
    } else if (!candidateUser.password_hash) {
      // If user exists without password_hash, update with candidate123
      const cSalt = bcrypt.genSaltSync(10);
      const cHash = bcrypt.hashSync('candidate123', cSalt);
      await dbAsync.run('UPDATE applicants SET password_hash = ? WHERE id = ?', [cHash, candidateUser.id]);
    }

    // Seed initial active jobs if none exist
    const jobCount = await dbAsync.get('SELECT COUNT(*) as count FROM jobs');
    if (!jobCount || jobCount.count === 0) {
      const sampleJobs = [
        [
          'Senior Full-Stack Engineer',
          'Engineering',
          'Bangalore, KA (Hybrid / Remote)',
          '₹18,00,000 - ₹26,00,000 / year',
          'Full-time',
          'We are looking for a Senior Full-Stack Engineer to architect, build, and scale our core SaaS products. You will work across Node.js backend systems, modern Vanilla and reactive frontend architectures, and high-throughput SQL databases.',
          '5+ years Node.js, Express, JavaScript/TypeScript, SQL, REST APIs, Microservices, CI/CD pipeline automation.',
          'Active'
        ],
        [
          'Product Designer (UI/UX)',
          'Design',
          'Mumbai, MH (Hybrid)',
          '₹12,00,000 - ₹18,00,000 / year',
          'Full-time',
          'Join our product design team to create beautiful, intuitive user journeys and high-fidelity prototypes. You will collaborate closely with engineering and product management to deliver world-class digital experiences.',
          '3+ years in digital product design, wireframing, design systems, user research, responsive web design.',
          'Active'
        ],
        [
          'DevOps & Cloud Infrastructure Engineer',
          'DevOps',
          'Hyderabad, TS (Remote)',
          '₹16,00,000 - ₹24,00,000 / year',
          'Full-time',
          'Responsible for cloud infrastructure automation, container orchestration, monitoring, and security hardening. You will manage deployment pipelines and ensure 99.99% system availability.',
          'Strong experience with Docker, Kubernetes, Linux, Terraform, AWS/GCP, GitHub Actions, observability tools.',
          'Active'
        ],
        [
          'Associate Frontend Developer',
          'Engineering',
          'Pune, MH (On-site)',
          '₹6,50,000 - ₹9,50,000 / year',
          'Full-time',
          'Seeking an enthusiastic Associate Frontend Developer with solid knowledge of semantic HTML5, modern CSS3 animations, and core JavaScript. You will build user-facing features and optimize page speed.',
          'Proficiency in JavaScript (ES6+), HTML5, CSS Grid/Flexbox, DOM manipulation, responsive layouts.',
          'Active'
        ],
        [
          'Technical Recruitment Specialist',
          'Human Resources',
          'Gurgaon / Delhi NCR (Hybrid)',
          '₹7,00,000 - ₹11,00,000 / year',
          'Full-time',
          'Manage end-to-end recruitment lifecycle for engineering and product roles. Source top talent, conduct screening interviews, and coordinate with hiring managers.',
          '2+ years in technical recruiting or talent acquisition, ATS management, excellent communication skills.',
          'Active'
        ]
      ];

      for (const job of sampleJobs) {
        await dbAsync.run(
          `INSERT INTO jobs (title, department, location, salary_range, job_type, description, requirements, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          job
        );
      }
      console.log('Sample jobs seeded successfully.');
    }

    console.log('Database schema and tables initialized.');
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

// Run init
initializeDatabase();

module.exports = {
  db,
  dbAsync,
  initializeDatabase
};
