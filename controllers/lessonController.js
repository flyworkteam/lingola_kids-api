const {
  getLessonsWithProgress,
  getLessonDetail
} = require('../services/lessonCatalogService');

const getLessons = async (req, res, next) => {
  try {
    const lessons = await getLessonsWithProgress(req.user?.id || 0);
    res.json({
      success: true,
      data: { lessons }
    });
  } catch (error) {
    next(error);
  }
};

const getLessonBySlug = async (req, res, next) => {
  try {
    const languageCode = req.query.language || req.query.lang || req.user?.preferred_language || 'en';
    const lesson = await getLessonDetail(req.params.lessonSlug, languageCode);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }
    res.json({
      success: true,
      data: { lesson }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLessons,
  getLessonBySlug
};
