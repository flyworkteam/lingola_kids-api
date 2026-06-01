const {
  resolveVoiceAssets,
  generateMissingVoices
} = require('../services/voiceAssetService');

const resolveVoices = async (req, res, next) => {
  try {
    const languageCode = req.query.language || req.query.lang || 'en';
    const lessonSlug = req.query.lessonSlug || req.query.lesson_slug;
    const voiceId = req.query.voiceId || req.query.voice_id;
    const shouldGenerateMissing =
      req.query.generateMissing === 'true' || req.query.generate_missing === 'true';
    const itemKeys = String(req.query.itemKeys || req.query.item_keys || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    let voices = await resolveVoiceAssets({ languageCode, lessonSlug, itemKeys });
    const missingItemKeys = voices
      .filter((voice) => !voice.voiceUrl && !voice.voice_url)
      .map((voice) => voice.itemKey || voice.item_key);

    if (shouldGenerateMissing && lessonSlug && missingItemKeys.length > 0) {
      await generateMissingVoices({
        languageCode,
        lessonSlug,
        itemKeys: missingItemKeys,
        voiceId
      });
      voices = await resolveVoiceAssets({ languageCode, lessonSlug, itemKeys });
    }

    res.json({
      success: true,
      data: { voices }
    });
  } catch (error) {
    next(error);
  }
};

const generateVoices = async (req, res, next) => {
  try {
    const languageCode = req.body.language || req.body.language_code || 'en';
    const lessonSlug = req.body.lessonSlug || req.body.lesson_slug;
    const itemKeys = req.body.itemKeys || req.body.item_keys || [];
    const voiceId = req.body.voiceId || req.body.voice_id;

    const generated = await generateMissingVoices({
      languageCode,
      lessonSlug,
      itemKeys,
      voiceId
    });

    res.status(201).json({
      success: true,
      message: 'Voice generation completed',
      data: { generated }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  resolveVoices,
  generateVoices
};
