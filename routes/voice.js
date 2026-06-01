const express = require('express');
const { body } = require('express-validator');
const { authenticateToken, requireAdminKey } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const {
  resolveVoices,
  generateVoices
} = require('../controllers/voiceController');

const router = express.Router();

router.get('/resolve', resolveVoices);

router.post(
  '/admin/generate',
  authenticateToken,
  requireAdminKey,
  [
    body('lessonSlug').optional().isString(),
    body('lesson_slug').optional().isString(),
    body('itemKeys').optional().isArray(),
    body('item_keys').optional().isArray()
  ],
  handleValidationErrors,
  generateVoices
);

module.exports = router;
