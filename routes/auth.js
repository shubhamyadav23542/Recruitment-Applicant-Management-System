const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAsync } = require('../database/database');
const { authenticateAnyUser, JWT_SECRET } = require('../middleware/authMiddleware');

// POST /api/auth/login (Supports both Recruiter and Candidate)
router.post('/login', async (req, res) => {
  try {
    const { username, password, role = 'recruiter' } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Username and password are required.'
      });
    }

    const cleanUser = username.trim();

    if (role === 'candidate' || role === 'applicant') {
      // 1. Candidate Login
      const candidate = await dbAsync.get(
        'SELECT * FROM applicants WHERE LOWER(email) = LOWER(?)',
        [cleanUser]
      );

      if (!candidate) {
        return res.status(401).json({
          success: false,
          message: 'No candidate account found with this email. Please register first.'
        });
      }

      if (!candidate.password_hash) {
        return res.status(401).json({
          success: false,
          message: 'Password not set for this candidate. Please sign up to create a password.'
        });
      }

      const isMatch = bcrypt.compareSync(password, candidate.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Password incorrect.'
        });
      }

      // JWT for Candidate
      const token = jwt.sign(
        {
          id: candidate.id,
          email: candidate.email,
          full_name: candidate.full_name,
          role: 'candidate'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Candidate login successful.',
        token,
        role: 'candidate',
        user: {
          id: candidate.id,
          email: candidate.email,
          full_name: candidate.full_name,
          phone: candidate.phone,
          skills: candidate.skills,
          education: candidate.education,
          experience: candidate.experience,
          role: 'candidate'
        }
      });
    } else {
      // 2. Recruiter / HR Admin Login
      const admin = await dbAsync.get(
        'SELECT * FROM admins WHERE username = ? OR LOWER(email) = LOWER(?)',
        [cleanUser, cleanUser]
      );

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Recruiter account not found.'
        });
      }

      const isMatch = bcrypt.compareSync(password, admin.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Password incorrect.'
        });
      }

      // JWT for Recruiter / Admin
      const token = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Recruiter login successful.',
        token,
        role: 'recruiter',
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        },
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        }
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
});

// POST /api/auth/register (Supports both Recruiter and Candidate)
router.post('/register', async (req, res) => {
  try {
    const {
      role = 'candidate',
      full_name,
      email,
      password,
      phone,
      education,
      skills,
      experience,
      username
    } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email, and Password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    if (role === 'candidate' || role === 'applicant') {
      // Check existing applicant
      const existing = await dbAsync.get(
        'SELECT * FROM applicants WHERE LOWER(email) = LOWER(?)',
        [cleanEmail]
      );

      let applicantId;
      if (existing) {
        if (existing.password_hash) {
          return res.status(409).json({
            success: false,
            message: 'An account with this email already exists. Please sign in.'
          });
        }
        // Update existing applicant who previously applied without an account password
        await dbAsync.run(
          `UPDATE applicants 
           SET password_hash = ?, full_name = ?, phone = COALESCE(?, phone), 
               education = COALESCE(?, education), skills = COALESCE(?, skills), experience = COALESCE(?, experience),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [passwordHash, cleanName, phone || null, education || null, skills || null, experience || null, existing.id]
        );
        applicantId = existing.id;
      } else {
        const result = await dbAsync.run(
          `INSERT INTO applicants (full_name, email, phone, education, skills, experience, password_hash)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cleanName,
            cleanEmail,
            phone ? phone.trim() : '+91 98765 43210',
            education ? education.trim() : 'Bachelor of Engineering / Tech',
            skills ? skills.trim() : 'JavaScript, Web Development',
            experience ? experience.trim() : 'Fresher / Professional Experience',
            passwordHash
          ]
        );
        applicantId = result.lastID;
      }

      const token = jwt.sign(
        {
          id: applicantId,
          email: cleanEmail,
          full_name: cleanName,
          role: 'candidate'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        success: true,
        message: 'Candidate account created successfully.',
        token,
        role: 'candidate',
        user: {
          id: applicantId,
          email: cleanEmail,
          full_name: cleanName,
          phone: phone || '+91 98765 43210',
          role: 'candidate'
        }
      });
    } else {
      // Recruiter registration
      const cleanUser = (username || cleanEmail.split('@')[0]).trim();
      const existingAdmin = await dbAsync.get(
        'SELECT id FROM admins WHERE username = ? OR LOWER(email) = LOWER(?)',
        [cleanUser, cleanEmail]
      );

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'A recruiter with this username or email already exists.'
        });
      }

      const result = await dbAsync.run(
        `INSERT INTO admins (username, email, password_hash, full_name, role)
         VALUES (?, ?, ?, ?, 'Administrator')`,
        [cleanUser, cleanEmail, passwordHash, cleanName]
      );

      const token = jwt.sign(
        {
          id: result.lastID,
          username: cleanUser,
          email: cleanEmail,
          full_name: cleanName,
          role: 'Administrator'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(201).json({
        success: true,
        message: 'Recruiter account registered successfully.',
        token,
        role: 'recruiter',
        user: {
          id: result.lastID,
          username: cleanUser,
          email: cleanEmail,
          full_name: cleanName,
          role: 'Administrator'
        },
        admin: {
          id: result.lastID,
          username: cleanUser,
          email: cleanEmail,
          full_name: cleanName,
          role: 'Administrator'
        }
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.'
    });
  }
});

// POST /api/auth/demo-login (Instant 1-Click Demo Login)
router.post('/demo-login', async (req, res) => {
  try {
    const { role = 'recruiter' } = req.body;

    if (role === 'candidate' || role === 'applicant') {
      const candidate = await dbAsync.get(
        'SELECT * FROM applicants WHERE LOWER(email) = "candidate@example.com"'
      );

      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Demo candidate account not found in database.'
        });
      }

      const token = jwt.sign(
        {
          id: candidate.id,
          email: candidate.email,
          full_name: candidate.full_name,
          role: 'candidate'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Logged in as Demo Candidate (Aarav Sharma)',
        token,
        role: 'candidate',
        user: {
          id: candidate.id,
          email: candidate.email,
          full_name: candidate.full_name,
          phone: candidate.phone,
          skills: candidate.skills,
          role: 'candidate'
        }
      });
    } else {
      const admin = await dbAsync.get(
        'SELECT * FROM admins WHERE username = "admin" OR email = "admin@recruitment.com" LIMIT 1'
      );

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Demo admin account not found in database.'
        });
      }

      const token = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Logged in as Demo Recruiter (Lead HR)',
        token,
        role: 'recruiter',
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        },
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role || 'Administrator'
        }
      });
    }
  } catch (err) {
    console.error('Demo login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete demo login.'
    });
  }
});

// GET /api/auth/me - Verify current logged-in user (Recruiter or Candidate)
router.get('/me', authenticateAnyUser, async (req, res) => {
  try {
    if (req.user.role === 'candidate') {
      const candidate = await dbAsync.get(
        'SELECT id, full_name, email, phone, education, skills, experience, created_at FROM applicants WHERE id = ?',
        [req.user.id]
      );
      if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate account not found.' });
      }
      return res.json({
        success: true,
        role: 'candidate',
        user: { ...candidate, role: 'candidate' }
      });
    } else {
      const admin = await dbAsync.get(
        'SELECT id, username, email, full_name, role, created_at FROM admins WHERE id = ?',
        [req.user.id]
      );
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin account not found.' });
      }
      return res.json({
        success: true,
        role: 'recruiter',
        admin,
        user: { ...admin, role: admin.role || 'Administrator' }
      });
    }
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify session.'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
