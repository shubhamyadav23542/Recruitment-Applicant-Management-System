const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database
const { initializeDatabase } = require('../../database/database');
try {
  initializeDatabase();
} catch (e) {
  console.log('Database init in serverless context:', e.message);
}

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Support Netlify Functions path rewriting (strip /.netlify/functions/api)
const router = express.Router();

router.use('/auth', require('../../routes/auth'));
router.use('/jobs', require('../../routes/jobs'));
router.use('/applicants', require('../../routes/applicants'));
router.use('/candidates', require('../../routes/candidates'));
router.use('/applications', require('../../routes/applications'));
router.use('/interviews', require('../../routes/interviews'));
router.use('/dashboard', require('../../routes/dashboard'));

// Mount both with /api and directly on router for Netlify rewrite compatibility
app.use('/.netlify/functions/api', router);
app.use('/api', router);

module.exports.handler = serverless(app);
