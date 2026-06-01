const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const {
  getLessons,
  getLessonBySlug
} = require('../controllers/lessonController');

const router = express.Router();

router.get('/', optionalAuth, getLessons);
router.get('/:lessonSlug', optionalAuth, getLessonBySlug);

module.exports = router;
