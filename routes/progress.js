const express = require('express');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const {
  getCurrent,
  getSummary,
  saveProgress,
  saveEvent
} = require('../controllers/progressController');

const router = express.Router();

router.get('/current', authenticateToken, getCurrent);
router.get('/summary', authenticateToken, getSummary);

router.put(
  '/:lessonSlug/:activitySlug',
  authenticateToken,
  [
    body('currentItemIndex').optional().isInt({ min: 0 }).withMessage('currentItemIndex must be non-negative'),
    body('current_item_index').optional().isInt({ min: 0 }).withMessage('current_item_index must be non-negative'),
    body('progressPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('progressPercent must be between 0 and 100'),
    body('progress_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('progress_percent must be between 0 and 100')
  ],
  handleValidationErrors,
  saveProgress
);

router.post(
  '/events',
  authenticateToken,
  [
    body('lessonSlug').optional().isString(),
    body('lesson_slug').optional().isString(),
    body('activitySlug').optional().isString(),
    body('activity_slug').optional().isString(),
    body('eventType').optional().isString(),
    body('event_type').optional().isString()
  ],
  handleValidationErrors,
  saveEvent
);

module.exports = router;
