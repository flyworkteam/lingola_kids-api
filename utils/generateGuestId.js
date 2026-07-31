const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const generateGuestId = () => `guest_${uuidv4()}`;

const generateDeviceId = (userAgent = '', platform = '') => {
  // Fallback only when client does not send a stable device_id.
  return crypto
    .createHash('sha256')
    .update(`${userAgent}:${platform}:${uuidv4()}`)
    .digest('hex');
};

module.exports = { generateGuestId, generateDeviceId };
