const {
  upsertProgress,
  getCurrentProgress,
  getProgressSummary,
  recordEvent
} = require('../services/progressService');

const getCurrent = async (req, res, next) => {
  try {
    const progress = await getCurrentProgress(req.user.id);
    res.json({
      success: true,
      data: { progress }
    });
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const progress = await getProgressSummary(req.user.id);
    res.json({
      success: true,
      data: { progress }
    });
  } catch (error) {
    next(error);
  }
};

const saveProgress = async (req, res, next) => {
  try {
    const progress = await upsertProgress({
      userId: req.user.id,
      lessonSlug: req.params.lessonSlug,
      activitySlug: req.params.activitySlug,
      body: req.body
    });
    res.json({
      success: true,
      message: 'Progress saved successfully',
      data: { progress }
    });
  } catch (error) {
    next(error);
  }
};

const saveEvent = async (req, res, next) => {
  try {
    const event = await recordEvent({
      userId: req.user.id,
      body: req.body
    });
    res.status(201).json({
      success: true,
      message: 'Progress event recorded',
      data: { event }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrent,
  getSummary,
  saveProgress,
  saveEvent
};
