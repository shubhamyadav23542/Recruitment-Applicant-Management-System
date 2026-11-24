const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'recruitment_super_secret_jwt_key_2026';

// Optional Auth: Attaches user if token is valid, otherwise continues as guest
function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// Authenticates any valid JWT token (Admin/Recruiter OR Candidate)
function authenticateAnyUser(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.'
    });
  }
}

// Authenticates specifically Admin / Recruiter roles
function authenticateAdmin(req, res, next) {
  authenticateAnyUser(req, res, () => {
    if (req.user.role === 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Access restricted to recruiters and administrators only.'
      });
    }
    next();
  });
}

// Authenticates specifically Candidate / Applicant roles
function authenticateCandidate(req, res, next) {
  authenticateAnyUser(req, res, () => {
    if (req.user.role !== 'candidate') {
      return res.status(403).json({
        success: false,
        message: 'Access restricted to candidate accounts.'
      });
    }
    next();
  });
}

module.exports = {
  optionalAuth,
  authenticateAdmin,
  authenticateCandidate,
  authenticateAnyUser,
  JWT_SECRET
};
