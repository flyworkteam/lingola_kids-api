const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '7d';
const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10);

const tokenUserPayload = (user) => ({
  id: user.id,
  email: user.email,
  isGuest: !!user.is_guest,
  authProvider: user.auth_provider
});

const generateTokenPair = (user) => {
  const payload = tokenUserPayload(user);
  return {
    accessToken: jwt.sign(payload, ACCESS_SECRET, {
      expiresIn: ACCESS_EXPIRES_IN,
      issuer: 'lingola-kids-api'
    }),
    refreshToken: jwt.sign(payload, REFRESH_SECRET, {
      expiresIn: `${REFRESH_DAYS}d`,
      issuer: 'lingola-kids-api'
    })
  };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_SECRET, { issuer: 'lingola-kids-api' });
  } catch (error) {
    error.message = 'Invalid or expired token';
    throw error;
  }
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET, { issuer: 'lingola-kids-api' });
};

const refreshExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);
  return expiresAt;
};

module.exports = {
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
  refreshExpiresAt
};
