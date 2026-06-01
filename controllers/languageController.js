const { pool } = require('../config/database');

const getAvailableLanguages = async (req, res, next) => {
  try {
    const [languages] = await pool.execute(
      `SELECT code, name
       FROM languages
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
    );

    res.json({
      success: true,
      data: { languages }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAvailableLanguages };
