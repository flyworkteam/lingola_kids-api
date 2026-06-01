require('dotenv').config();

const region = process.env.BUNNY_STORAGE_REGION || '';
const storageHost = region
  ? `https://${region}.storage.bunnycdn.com`
  : 'https://storage.bunnycdn.com';

module.exports = {
  storageZone: process.env.BUNNY_STORAGE_ZONE,
  storageApiKey: process.env.BUNNY_STORAGE_API_KEY,
  cdnBaseUrl: process.env.BUNNY_CDN_BASE_URL,
  storageBaseUrl: storageHost
};
