const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'recruitment_super_secret_jwt_key_2026';

function authenticateAdmin(req, res, next) {
  // Check Authorization header or query parameter (query param useful for direct resume links in browser)
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
      message: 'Invalid or expired authentication session. Please log in again.'
    });
  }
}

module.exports = {
  authenticateAdmin,
  JWT_SECRET
};
