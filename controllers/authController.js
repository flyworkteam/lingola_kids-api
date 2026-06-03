const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');
const { generateTokenPair, refreshExpiresAt, verifyRefreshToken } = require('../utils/jwt');
const { generateGuestId, generateDeviceId } = require('../utils/generateGuestId');
const { generateUniqueReferralCode } = require('../utils/generateReferralCode');

const googleClient = new OAuth2Client();
const WELCOME_PREMIUM_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

const welcomePremiumEndTime = () => new Date(Date.now() + WELCOME_PREMIUM_DURATION_MS);

const compactUnique = (values) => [
  ...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))
];

const googleAudiences = () => compactUnique([
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
  process.env.GOOGLE_WEB_CLIENT_ID
]);

const appleAudiences = () => compactUnique([
  process.env.APPLE_BUNDLE_ID,
  process.env.APPLE_SERVICE_ID
]);

const normalizeDisplayName = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'object') {
    const firstName = value.firstName || value.givenName || value.first_name || '';
    const lastName = value.lastName || value.familyName || value.last_name || '';
    return `${firstName} ${lastName}`.trim() || null;
  }
  return null;
};

const fallbackSocialEmail = (provider, providerId) => {
  const safeProviderId = String(providerId || crypto.randomUUID()).replace(/[^a-zA-Z0-9._-]/g, '');
  return `${provider}_${safeProviderId}@lingolakids.local`;
};

const userResponse = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.full_name,
  full_name: user.full_name,
  avatarKey: user.avatar_key || 'avatar1',
  avatar_key: user.avatar_key || 'avatar1',
  authProvider: user.auth_provider,
  auth_provider: user.auth_provider,
  isGuest: !!user.is_guest,
  is_guest: !!user.is_guest,
  isPremium: !!user.is_premium,
  is_premium: !!user.is_premium,
  premiumEndTime: user.premium_endtime,
  premium_endtime: user.premium_endtime,
  onboardingCompleted: !!user.onboarding_completed,
  onboarding_completed: !!user.onboarding_completed,
  preferredLanguage: user.preferred_language || 'en',
  preferred_language: user.preferred_language || 'en',
  invitationCode: user.invitation_code,
  invitation_code: user.invitation_code,
  createdAt: user.created_at,
  created_at: user.created_at
});

const saveRefreshToken = async (connection, userId, refreshToken, deviceInfo = null) => {
  await connection.execute(
    'INSERT INTO refresh_tokens (user_id, token, device_info, expires_at) VALUES (?, ?, ?, ?)',
    [userId, refreshToken, deviceInfo ? JSON.stringify(deviceInfo).slice(0, 255) : null, refreshExpiresAt()]
  );
};

const authPayload = async (connection, user, deviceInfo = null) => {
  const tokens = generateTokenPair(user);
  await saveRefreshToken(connection, user.id, tokens.refreshToken, deviceInfo);
  return {
    user: userResponse(user),
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d'
    }
  };
};

const mergeGuestIntoUser = async (connection, guestUserId, targetUserId) => {
  if (!guestUserId || guestUserId === targetUserId) return;

  await connection.execute(
    `INSERT INTO user_lesson_progress (
       user_id, lesson_id, activity_id, route_name, current_item_index, current_item_key,
       progress_percent, status, attempts, correct_count, last_answer_correct, resume_payload, client_event_at
     )
     SELECT ?, lesson_id, activity_id, route_name, current_item_index, current_item_key,
            progress_percent, status, attempts, correct_count, last_answer_correct, resume_payload, client_event_at
     FROM user_lesson_progress
     WHERE user_id = ?
     ON DUPLICATE KEY UPDATE
       progress_percent = GREATEST(progress_percent, VALUES(progress_percent)),
       status = IF(status = 'completed', status, VALUES(status)),
       updated_at = CURRENT_TIMESTAMP`,
    [targetUserId, guestUserId]
  );

  await connection.execute(
    'UPDATE user_activity_events SET user_id = ? WHERE user_id = ?',
    [targetUserId, guestUserId]
  );

  await connection.execute(
    `UPDATE users target
     JOIN users guest ON guest.id = ?
     SET target.avatar_key = IF(target.avatar_key IS NULL OR target.avatar_key = 'avatar1', guest.avatar_key, target.avatar_key),
         target.preferred_language = IF(target.preferred_language = 'en', guest.preferred_language, target.preferred_language)
     WHERE target.id = ?`,
    [guestUserId, targetUserId]
  );

  await connection.execute(
    'UPDATE users SET is_active = 0, deleted_at = NOW() WHERE id = ?',
    [guestUserId]
  );

  await connection.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [guestUserId]);
};

const getBearerUser = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-access-secret', {
      issuer: 'lingola-kids-api'
    });
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE id = ? AND is_active = 1 AND deleted_at IS NULL',
      [decoded.id]
    );
    return rows[0] || null;
  } catch (_) {
    return null;
  }
};

const createGuestUser = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { device_info } = req.body;
    const userAgent = req.get('user-agent') || '';
    const platform = device_info?.platform || '';
    const guestId = generateGuestId();
    const deviceId = generateDeviceId(userAgent, platform);
    const invitationCode = await generateUniqueReferralCode(connection);
    const email = `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}@lingolakids.local`;

    const [result] = await connection.execute(
      `INSERT INTO users (
         email, full_name, auth_provider, provider_id, is_guest, guest_device_id,
         invitation_code, avatar_key, is_premium, premium_endtime
       ) VALUES (?, ?, 'guest', ?, 1, ?, ?, 'avatar1', 1, ?)`,
      [email, 'Guest', guestId, deviceId, invitationCode, welcomePremiumEndTime()]
    );

    const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const payload = await authPayload(connection, users[0], device_info);

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Guest user created successfully',
      data: payload
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const verifyGoogleToken = async (idToken) => {
  if (process.env.ALLOW_UNVERIFIED_SOCIAL_AUTH === 'true') {
    const decoded = jwt.decode(idToken) || {};
    return {
      providerId: decoded.sub || `dev-google-${Date.now()}`,
      email: decoded.email || null,
      fullName: decoded.name || null
    };
  }

  const audiences = googleAudiences();
  if (audiences.length === 0) {
    const error = new Error('Google client ID is not configured');
    error.statusCode = 500;
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: audiences
  });
  const payload = ticket.getPayload();
  return {
    providerId: payload.sub,
    email: payload.email || null,
    fullName: payload.name || null
  };
};

const verifyAppleToken = async (identityToken) => {
  const decoded = jwt.decode(identityToken, { complete: true }) || {};
  if (process.env.ALLOW_UNVERIFIED_SOCIAL_AUTH === 'true') {
    const payload = decoded.payload || {};
    return {
      providerId: payload.sub || `dev-apple-${Date.now()}`,
      email: payload.email || null
    };
  }

  const audiences = appleAudiences();
  if (audiences.length === 0) {
    const error = new Error('Apple client ID is not configured');
    error.statusCode = 500;
    throw error;
  }

  const keysResponse = await axios.get('https://appleid.apple.com/auth/keys');
  const jwk = keysResponse.data.keys.find((key) => key.kid === decoded.header?.kid);
  if (!jwk) {
    const error = new Error('Apple public key not found');
    error.statusCode = 401;
    throw error;
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({
    format: 'pem',
    type: 'spki'
  });
  const payload = jwt.verify(identityToken, publicKey, {
    algorithms: ['RS256'],
    audience: audiences
  });
  return {
    providerId: payload.sub,
    email: payload.email || null
  };
};

const socialSignIn = async ({ req, res, next, provider, identity }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const guestUser = await getBearerUser(req);
    const providerId = identity.providerId;
    const email = identity.email || fallbackSocialEmail(provider, providerId);
    const fullName = normalizeDisplayName(
      identity.fullName || req.body.user?.name || req.body.user?.fullName
    );

    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE auth_provider = ? AND provider_id = ? AND deleted_at IS NULL LIMIT 1',
      [provider, providerId]
    );

    let user;
    let isNewUser = false;

    if (existing.length > 0) {
      user = existing[0];
      if (guestUser?.is_guest) {
        await mergeGuestIntoUser(connection, guestUser.id, user.id);
      }
      await connection.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    } else if (guestUser?.is_guest) {
      await connection.execute(
        `UPDATE users
         SET email = ?, full_name = COALESCE(?, full_name), auth_provider = ?, provider_id = ?,
             is_guest = 0, last_login_at = NOW()
         WHERE id = ?`,
        [email, fullName, provider, providerId, guestUser.id]
      );
      const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [guestUser.id]);
      user = rows[0];
      isNewUser = false;
    } else {
      const invitationCode = await generateUniqueReferralCode(connection);
      const [result] = await connection.execute(
        `INSERT INTO users (
          email, full_name, auth_provider, provider_id, is_guest, invitation_code,
          avatar_key, is_premium, premium_endtime, last_login_at
        ) VALUES (?, ?, ?, ?, 0, ?, 'avatar1', 1, ?, NOW())`,
        [email, fullName, provider, providerId, invitationCode, welcomePremiumEndTime()]
      );
      const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = rows[0];
      isNewUser = true;
    }

    const payload = await authPayload(connection, user);
    payload.isNewUser = isNewUser;

    await connection.commit();
    res.json({
      success: true,
      message: `${provider} sign-in successful`,
      data: payload
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const googleSignIn = async (req, res, next) => {
  try {
    const identity = await verifyGoogleToken(req.body.idToken);
    return socialSignIn({ req, res, next, provider: 'google', identity });
  } catch (error) {
    next(error);
  }
};

const appleSignIn = async (req, res, next) => {
  try {
    const identity = await verifyAppleToken(req.body.identityToken);
    identity.fullName = normalizeDisplayName(req.body.user?.fullName || req.body.user?.name);
    return socialSignIn({ req, res, next, provider: 'apple', identity });
  } catch (error) {
    next(error);
  }
};

const refreshAccessToken = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { refreshToken } = req.body;
    verifyRefreshToken(refreshToken);

    const [tokens] = await connection.execute(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1',
      [refreshToken]
    );
    if (tokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
        requiresReLogin: true
      });
    }

    const [users] = await connection.execute(
      'SELECT * FROM users WHERE id = ? AND is_active = 1 AND deleted_at IS NULL LIMIT 1',
      [tokens[0].user_id]
    );
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        requiresReLogin: true
      });
    }

    await connection.beginTransaction();
    await connection.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    const payload = await authPayload(connection, users[0]);
    await connection.commit();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens: payload.tokens }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    next(error);
  } finally {
    connection.release();
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    } else {
      await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      message: 'Current user retrieved',
      data: { user: userResponse(users[0]) }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGuestUser,
  googleSignIn,
  appleSignIn,
  refreshAccessToken,
  logout,
  getCurrentUser,
  userResponse
};
