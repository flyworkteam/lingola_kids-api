const axios = require('axios');
const elevenlabs = require('../config/elevenlabs');

const generateSpeech = async ({ text, voiceId, languageCode }) => {
  const selectedVoiceId = voiceId || elevenlabs.defaultVoiceId;
  if (!elevenlabs.apiKey || !selectedVoiceId) {
    const error = new Error('ElevenLabs configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
    {
      text,
      model_id: elevenlabs.modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      },
      pronunciation_dictionary_locators: [],
      language_code: languageCode
    },
    {
      responseType: 'arraybuffer',
      headers: {
        'xi-api-key': elevenlabs.apiKey,
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json'
      }
    }
  );

  return Buffer.from(response.data);
};

module.exports = { generateSpeech };
