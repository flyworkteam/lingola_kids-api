const express = require('express');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  createGuestUser,
  googleSignIn,
  appleSignIn,
  refreshAccessToken,
  logout,
  getCurrentUser
} = require('../controllers/authController');

const router = express.Router();

router.post(
  '/guest',
  [body('device_info').optional().isObject().withMessage('Device info must be an object')],
  handleValidationErrors,
  createGuestUser
);

router.post(
  '/google',
  optionalAuth,
  [body('idToken').notEmpty().withMessage('ID token is required')],
  handleValidationErrors,
  googleSignIn
);

router.post(
  '/apple',
  optionalAuth,
  [body('identityToken').notEmpty().withMessage('Identity token is required')],
  handleValidationErrors,
  appleSignIn
);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  handleValidationErrors,
  refreshAccessToken
);

router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router;
