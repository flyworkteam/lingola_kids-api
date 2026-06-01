const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const randomCode = (length = 8) => {
  let value = '';
  for (let i = 0; i < length; i++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
};

const generateUniqueReferralCode = async (connection) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE invitation_code = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) return code;
  }
  throw new Error('Unable to generate unique invitation code');
};

module.exports = { generateUniqueReferralCode };
