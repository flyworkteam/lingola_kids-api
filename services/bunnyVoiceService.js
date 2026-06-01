const axios = require('axios');
const bunny = require('../config/bunnycdn');

const uploadVoiceBuffer = async ({ buffer, cdnKey, mimeType = 'audio/mpeg' }) => {
  if (!bunny.storageZone || !bunny.storageApiKey || !bunny.cdnBaseUrl) {
    const error = new Error('BunnyCDN configuration is missing');
    error.statusCode = 500;
    throw error;
  }

  const normalizedKey = cdnKey.replace(/^\/+/, '');
  const uploadUrl = `${bunny.storageBaseUrl}/${bunny.storageZone}/${normalizedKey}`;
  const cdnBaseUrl = /^https?:\/\//i.test(bunny.cdnBaseUrl)
    ? bunny.cdnBaseUrl
    : `https://${bunny.cdnBaseUrl}`;

  await axios.put(uploadUrl, buffer, {
    headers: {
      AccessKey: bunny.storageApiKey,
      'Content-Type': mimeType
    },
    maxBodyLength: Infinity
  });

  return `${cdnBaseUrl.replace(/\/$/, '')}/${normalizedKey}`;
};

module.exports = { uploadVoiceBuffer };
