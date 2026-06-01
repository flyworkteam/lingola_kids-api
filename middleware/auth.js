const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');

const tokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

const loadUserFromToken = async (req) => {
  const token = tokenFromRequest(req);
  if (!token) return null;

  const decoded = verifyToken(token);
  const [users] = await pool.execute(
    `SELECT id, email, full_name, auth_provider, is_guest, is_active, onboarding_completed, avatar_key
     FROM users
     WHERE id = ? AND deleted_at IS NULL`,
    [decoded.id]
  );
  if (users.length === 0) return null;
  return { user: users[0], token: decoded };
};

const authenticateToken = async (req, res, next) => {
  try {
    const auth = await loadUserFromToken(req);
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }
    if (!auth.user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }
    req.user = auth.user;
    req.token = auth.token;
    next();
  } catch (error) {
    if (error.message === 'Invalid or expired token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token',
        shouldRefresh: true
      });
    }
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const auth = await loadUserFromToken(req);
    if (auth && auth.user.is_active) {
      req.user = auth.user;
      req.token = auth.token;
    }
    next();
  } catch (_) {
    next();
  }
};

const requireAdminKey = (req, res, next) => {
  if (!process.env.ADMIN_API_KEY) return next();
  if (req.get('x-admin-key') === process.env.ADMIN_API_KEY) return next();
  return res.status(403).json({
    success: false,
    message: 'Admin API key is required'
  });
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdminKey
};
