const { pool } = require('../config/database');
const { userResponse } = require('./authController');

const allowedAvatars = new Set(['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6']);

const PREMIUM_WELCOME_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

const calculateWelcomePremiumEndTime = (premiumEndtime) => {
  const now = new Date();
  const existingPremiumEndTime = premiumEndtime ? new Date(premiumEndtime) : null;

  if (existingPremiumEndTime && existingPremiumEndTime > now) {
    return new Date(existingPremiumEndTime.getTime() + PREMIUM_WELCOME_DURATION_MS);
  }

  return new Date(now.getTime() + PREMIUM_WELCOME_DURATION_MS);
};

const getWeekActivityAndStreak = async (userId) => {
  const [weekActivityData] = await pool.execute(
    `SELECT DAYOFWEEK(activity_date) AS day_index
     FROM user_activity_logs
     WHERE user_id = ? AND YEARWEEK(activity_date, 0) = YEARWEEK(CURRENT_DATE(), 0)`,
    [userId]
  );

  const weekActivity = [false, false, false, false, false, false, false];
  for (const record of weekActivityData) {
    weekActivity[record.day_index - 1] = true;
  }

  const [recentDates] = await pool.execute(
    `SELECT activity_date
     FROM user_activity_logs
     WHERE user_id = ?
     ORDER BY activity_date DESC
     LIMIT 365`,
    [userId]
  );

  let currentStreak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (let index = 0; index < recentDates.length; index++) {
    const date = new Date(recentDates[index].activity_date);
    date.setHours(0, 0, 0, 0);

    if (index === 0 && date.getTime() !== expected.getTime()) {
      expected.setDate(expected.getDate() - 1);
    }

    if (date.getTime() !== expected.getTime()) break;
    currentStreak++;
    expected.setDate(expected.getDate() - 1);
  }

  return { currentStreak, weekActivity };
};

const getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [categories] = await pool.execute(
      'SELECT category_name FROM user_preferred_categories WHERE user_id = ?',
      [userId]
    );
    const streak = await getWeekActivityAndStreak(userId);

    res.json({
      success: true,
      data: {
        user: {
          ...userResponse(users[0]),
          age: users[0].age,
          gender: users[0].gender,
          country: users[0].country,
          lastLoginAt: users[0].last_login_at,
          last_login_at: users[0].last_login_at,
          updatedAt: users[0].updated_at,
          updated_at: users[0].updated_at
        },
        profile: {
          preferredCategories: categories.map((category) => category.category_name),
          preferred_categories: categories.map((category) => category.category_name)
        },
        streak
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      full_name,
      fullName,
      age,
      preferred_language,
      preferredLanguage,
      gender,
      country,
      avatar_key,
      avatarKey
    } = req.body;

    const selectedAvatar = avatar_key || avatarKey;
    if (selectedAvatar && !allowedAvatars.has(selectedAvatar)) {
      return res.status(422).json({
        success: false,
        message: 'Validation Failed',
        errors: [{ field: 'avatar_key', message: 'Unknown avatar key' }]
      });
    }

    const updates = [];
    const values = [];
    const fields = {
      full_name: full_name ?? fullName,
      age,
      preferred_language: preferred_language ?? preferredLanguage,
      gender,
      country,
      avatar_key: selectedAvatar
    };

    for (const [column, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(userId);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
};

const savePreferences = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.id;
    const {
      preferred_language,
      preferredLanguage,
      full_name,
      fullName,
      age,
      gender,
      preferred_categories,
      preferredCategories
    } = req.body;

    const [users] = await connection.execute(
      'SELECT onboarding_completed, is_premium, premium_endtime FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = users[0];
    const now = new Date();
    const currentPremiumEndTime = userData.premium_endtime ? new Date(userData.premium_endtime) : null;
    const hasActivePremium = !!userData.is_premium && currentPremiumEndTime && currentPremiumEndTime > now;
    const shouldGrantWelcomePremium = !userData.onboarding_completed && !hasActivePremium;
    const welcomePremiumEndTime = shouldGrantWelcomePremium
      ? calculateWelcomePremiumEndTime(userData.premium_endtime)
      : null;

    const updates = [];
    const values = [];
    const fields = {
      preferred_language: preferred_language ?? preferredLanguage,
      full_name: full_name ?? fullName,
      age,
      gender,
      onboarding_completed: 1
    };

    for (const [column, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && value !== '') {
        updates.push(`${column} = ?`);
        values.push(value);
      }
    }

    if (shouldGrantWelcomePremium) {
      updates.push('is_premium = ?');
      values.push(1);
      updates.push('premium_endtime = ?');
      values.push(welcomePremiumEndTime);
    }

    values.push(userId);
    await connection.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const categories = preferred_categories || preferredCategories || [];
    if (Array.isArray(categories)) {
      await connection.execute('DELETE FROM user_preferred_categories WHERE user_id = ?', [userId]);
      for (const category of categories) {
        await connection.execute(
          'INSERT IGNORE INTO user_preferred_categories (user_id, category_name) VALUES (?, ?)',
          [userId, String(category)]
        );
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: shouldGrantWelcomePremium
        ? 'Preferences saved successfully. 2 days of premium added.'
        : 'Preferences saved successfully',
      data: {
        onboardingCompleted: true,
        premiumGranted: shouldGrantWelcomePremium,
        premiumEndTime: welcomePremiumEndTime
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const logActivity = async (req, res, next) => {
  try {
    await pool.execute(
      `INSERT IGNORE INTO user_activity_logs (user_id, activity_date)
       VALUES (?, CURRENT_DATE())`,
      [req.user.id]
    );
    res.json({ success: true, message: 'Activity logged successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const userId = req.user.id;

    await connection.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_lesson_progress WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_activity_events WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_preferred_categories WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_activity_logs WHERE user_id = ?', [userId]);
    await connection.execute(
      `UPDATE users
       SET is_active = 0,
           deleted_at = NOW(),
           email = CONCAT('deleted_', id, '@lingolakids.local'),
           full_name = NULL,
           provider_id = NULL
       WHERE id = ?`,
      [userId]
    );

    await connection.commit();
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  savePreferences,
  logActivity,
  deleteAccount,
  allowedAvatars
};
