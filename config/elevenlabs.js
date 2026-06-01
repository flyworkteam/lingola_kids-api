require('dotenv').config();

module.exports = {
  apiKey: process.env.ELEVENLABS_API_KEY,
  defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID,
  modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
};
