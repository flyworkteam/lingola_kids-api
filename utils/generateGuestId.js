const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const generateGuestId = () => `guest_${uuidv4()}`;

const generateDeviceId = (userAgent = '', platform = '') => {
  return crypto
    .createHash('sha256')
    .update(`${userAgent}:${platform}:${Date.now()}:${Math.random()}`)
    .digest('hex');
};

module.exports = { generateGuestId, generateDeviceId };
