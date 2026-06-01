const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const {
  getUserProfile,
  updateUserProfile,
  savePreferences,
  logActivity,
  deleteAccount
} = require('../controllers/userController');

const router = express.Router();

router.get('/profile', authenticateToken, getUserProfile);

router.put(
  '/profile',
  authenticateToken,
  [
    body('age').optional().isInt({ min: 1, max: 120 }).withMessage('Age must be a valid number'),
    body('preferred_language').optional().isLength({ min: 2, max: 2 }).withMessage('Language must be a 2-letter code'),
    body('avatar_key').optional().isString().withMessage('Avatar key must be a string')
  ],
  handleValidationErrors,
  updateUserProfile
);

router.post('/preferences', authenticateToken, savePreferences);
router.post('/activity', authenticateToken, logActivity);
router.delete('/account', authenticateToken, deleteAccount);

module.exports = router;
