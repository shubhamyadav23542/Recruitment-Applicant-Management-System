const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database
const { initializeDatabase } = require('./database/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads/resumes directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'resumes');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applicants', require('./routes/applicants'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Convenience page routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'candidate-portal.html'));
});

app.get('/candidate-portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'candidate-portal.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Fallback for HTML5 client routing (non-API)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Recruitment & Applicant Management System running!`);
  console.log(`📡 Local Server URL: http://localhost:${PORT}`);
  console.log(`👤 Admin Dashboard: http://localhost:${PORT}/login.html`);
  console.log(`📝 Candidate Application Portal: http://localhost:${PORT}/apply.html`);
  console.log(`🔑 Default Admin Credentials: admin@recruitment.com / admin123`);
  console.log(`=======================================================`);
});
