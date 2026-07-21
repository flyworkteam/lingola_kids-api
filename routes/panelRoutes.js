const express = require('express');
const { query } = require('../config/database');
const panelAuth = require('../middleware/panelAuth');

const router = express.Router();
router.use(panelAuth);

function positiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function likeTerm(value) {
  return `%${String(value || '').trim()}%`;
}

function pagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function cleanString(value, { allowEmpty = false } = {}) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed && !allowEmpty) return null;
  return trimmed;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBool(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function mapUser(row) {
  return {
    id: row.id,
    authId: row.email || row.guest_device_id || String(row.id),
    displayName: row.full_name || row.email || `Kullanıcı #${row.id}`,
    email: row.email,
    status: row.is_active ? 'active' : 'inactive',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    extras: {
      authProvider: row.auth_provider,
      isGuest: row.is_guest === 1 || row.is_guest === true,
      isPremium: row.is_premium === 1 || row.is_premium === true,
      onboardingCompleted: row.onboarding_completed === 1 || row.onboarding_completed === true,
      preferredLanguage: row.preferred_language,
      age: row.age,
      country: row.country,
    },
  };
}

function mapLesson(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    assetKey: row.asset_key,
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active === 1 || row.is_active === true,
    activityCount: Number(row.activity_count || 0),
    itemCount: Number(row.item_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title || null,
    lessonSlug: row.lesson_slug || null,
    slug: row.slug,
    title: row.title,
    activityType: row.activity_type,
    routeName: row.route_name,
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  let metadata = row.metadata;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title || null,
    itemKey: row.item_key,
    label: row.label,
    assetKey: row.asset_key,
    drawAssetKey: row.draw_asset_key,
    sortOrder: Number(row.sort_order || 0),
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLanguage(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: Number(row.sort_order || 0),
    isActive: row.is_active === 1 || row.is_active === true,
  };
}

function mapVoice(row) {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    itemId: row.item_id,
    languageCode: row.language_code,
    voiceId: row.voice_id,
    provider: row.provider,
    voiceText: row.voice_text,
    cdnUrl: row.cdn_url,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/health', (_req, res) => res.json({ ok: true, service: 'lingolakids-panel' }));

router.get('/options', async (_req, res) => {
  try {
    const lessons = await query(
      'SELECT id, slug, title FROM lessons ORDER BY sort_order ASC, title ASC'
    );
    const languages = await query(
      'SELECT code, name FROM languages WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
    );
    const activityTypes = await query(
      'SELECT DISTINCT activity_type FROM lesson_activities ORDER BY activity_type ASC'
    );
    return res.json({
      ok: true,
      data: {
        lessons: lessons.map((row) => ({ id: row.id, slug: row.slug, title: row.title })),
        languages: languages.map((row) => ({ code: row.code, name: row.name })),
        activityTypes: activityTypes.map((row) => row.activity_type),
      },
    });
  } catch (error) {
    console.error('Lingola Kids panel options error:', error);
    return res.status(500).json({ ok: false, error: 'Seçenekler alınamadı.' });
  }
});

router.get('/analyse', async (_req, res) => {
  try {
    const [userTotals] = await query(`
      SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN COALESCE(is_premium, 0) = 1 THEN 1 ELSE 0 END) AS premiumUsers,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS newUsersToday
      FROM users
      WHERE deleted_at IS NULL
    `);

    const [catalog] = await query(`
      SELECT
        (SELECT COUNT(*) FROM lessons) AS totalLessons,
        (SELECT COUNT(*) FROM lesson_activities) AS totalActivities,
        (SELECT COUNT(*) FROM lesson_items) AS totalItems,
        (SELECT COUNT(*) FROM languages WHERE is_active = 1) AS totalLanguages,
        (SELECT COUNT(*) FROM voice_assets) AS totalVoices
    `);

    const daily = await query(`
      SELECT DATE(created_at) AS date, COUNT(*) AS newUsers
      FROM users
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const providerRows = await query(`
      SELECT auth_provider AS label, COUNT(*) AS count
      FROM users
      WHERE deleted_at IS NULL
      GROUP BY auth_provider
      ORDER BY count DESC
    `);

    return res.json({
      ok: true,
      contractVersion: 1,
      timezone: 'Europe/Istanbul',
      summary: {
        totalUsers: Number(userTotals?.totalUsers || 0),
        premiumUsers: Number(userTotals?.premiumUsers || 0),
        newUsersToday: Number(userTotals?.newUsersToday || 0),
        totalLessons: Number(catalog?.totalLessons || 0),
        totalActivities: Number(catalog?.totalActivities || 0),
        totalItems: Number(catalog?.totalItems || 0),
        totalLanguages: Number(catalog?.totalLanguages || 0),
        totalVoices: Number(catalog?.totalVoices || 0),
      },
      daily: daily.map((row) => ({
        date: row.date,
        newUsers: Number(row.newUsers || 0),
      })),
      insights: {
        premiumSplit: [
          { label: 'Premium', count: Number(userTotals?.premiumUsers || 0) },
          {
            label: 'Ücretsiz',
            count: Math.max(Number(userTotals?.totalUsers || 0) - Number(userTotals?.premiumUsers || 0), 0),
          },
        ],
        authProviders: providerRows,
      },
    });
  } catch (error) {
    console.error('Lingola Kids panel analyse error:', error);
    return res.status(500).json({ ok: false, error: 'Analiz verisi alınamadı.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1);
    const limit = positiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const search = cleanString(req.query.search);
    const premium = cleanString(req.query.premium);

    const where = ['u.deleted_at IS NULL'];
    const params = [];
    if (search) {
      where.push('(u.email LIKE ? OR u.full_name LIKE ? OR u.id = ? OR u.invitation_code LIKE ?)');
      const term = likeTerm(search);
      params.push(term, term, Number.isFinite(Number(search)) ? Number(search) : -1, term);
    }
    if (premium === '1' || premium === 'true') where.push('COALESCE(u.is_premium, 0) = 1');
    if (premium === '0' || premium === 'false') where.push('COALESCE(u.is_premium, 0) = 0');
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await query(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);

    const rows = await query(
      `SELECT u.*
       FROM users u
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map(mapUser),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    console.error('Lingola Kids panel users error:', error);
    return res.status(500).json({ ok: false, error: 'Kullanıcılar alınamadı.' });
  }
});

router.patch('/users/:userId', async (req, res) => {
  try {
    const userId = cleanString(req.params.userId);
    const exists = await query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' });

    const body = req.body || {};
    const sets = [];
    const params = [];
    const isPremium = parseBool(body.isPremium);
    const isActive = parseBool(body.isActive);

    if (isPremium !== null) {
      sets.push('is_premium = ?');
      params.push(isPremium ? 1 : 0);
    }
    if (isActive !== null) {
      sets.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Güncellenecek alan yok.' });

    await query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...params, userId]);
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    return res.json({ ok: true, data: mapUser(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel user patch error:', error);
    return res.status(500).json({ ok: false, error: 'Kullanıcı güncellenemedi.' });
  }
});

router.get('/lessons', async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1);
    const limit = positiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const search = cleanString(req.query.search);
    const active = cleanString(req.query.active);

    const where = ['1=1'];
    const params = [];
    if (search) {
      where.push('(l.title LIKE ? OR l.slug LIKE ? OR l.asset_key LIKE ?)');
      const term = likeTerm(search);
      params.push(term, term, term);
    }
    if (active === '1' || active === 'true') where.push('l.is_active = 1');
    if (active === '0' || active === 'false') where.push('l.is_active = 0');
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await query(`SELECT COUNT(*) AS total FROM lessons l ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);

    const rows = await query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM lesson_activities la WHERE la.lesson_id = l.id) AS activity_count,
        (SELECT COUNT(*) FROM lesson_items li WHERE li.lesson_id = l.id) AS item_count
       FROM lessons l
       ${whereSql}
       ORDER BY l.sort_order ASC, l.title ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map(mapLesson),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    console.error('Lingola Kids panel lessons error:', error);
    return res.status(500).json({ ok: false, error: 'Dersler alınamadı.' });
  }
});

router.get('/lessons/:lessonId', async (req, res) => {
  try {
    const lessonId = cleanString(req.params.lessonId);
    const rows = await query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM lesson_activities la WHERE la.lesson_id = l.id) AS activity_count,
        (SELECT COUNT(*) FROM lesson_items li WHERE li.lesson_id = l.id) AS item_count
       FROM lessons l WHERE l.id = ? LIMIT 1`,
      [lessonId]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Ders bulunamadı.' });
    return res.json({ ok: true, data: mapLesson(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel lesson detail error:', error);
    return res.status(500).json({ ok: false, error: 'Ders alınamadı.' });
  }
});

router.post('/lessons', async (req, res) => {
  try {
    const body = req.body || {};
    const title = cleanString(body.title);
    const slug = cleanString(body.slug) || slugify(title);
    const assetKey = cleanString(body.assetKey);
    if (!title || !slug || !assetKey) {
      return res.status(400).json({ ok: false, error: 'Başlık, slug ve asset key zorunludur.' });
    }

    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const isActive = parseBool(body.isActive);
    await query(
      `INSERT INTO lessons (slug, title, asset_key, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [slug, title, assetKey, sortOrder, isActive === false ? 0 : 1]
    );
    const rows = await query('SELECT * FROM lessons WHERE slug = ? LIMIT 1', [slug]);
    return res.status(201).json({ ok: true, data: mapLesson(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel lesson create error:', error);
    return res.status(500).json({ ok: false, error: 'Ders oluşturulamadı.' });
  }
});

router.patch('/lessons/:lessonId', async (req, res) => {
  try {
    const lessonId = cleanString(req.params.lessonId);
    const exists = await query('SELECT id FROM lessons WHERE id = ? LIMIT 1', [lessonId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Ders bulunamadı.' });

    const body = req.body || {};
    const fieldMap = [
      ['title', 'title'],
      ['slug', 'slug'],
      ['assetKey', 'asset_key'],
      ['sortOrder', 'sort_order'],
      ['isActive', 'is_active'],
    ];
    const sets = [];
    const params = [];
    fieldMap.forEach(([inputKey, column]) => {
      if (body[inputKey] === undefined) return;
      if (inputKey === 'isActive') {
        const value = parseBool(body.isActive);
        if (value === null) return;
        sets.push(`${column} = ?`);
        params.push(value ? 1 : 0);
        return;
      }
      if (inputKey === 'sortOrder') {
        sets.push(`${column} = ?`);
        params.push(Number(body.sortOrder) || 0);
        return;
      }
      const value = cleanString(body[inputKey], { allowEmpty: true });
      if (value === null && inputKey !== 'slug') return;
      sets.push(`${column} = ?`);
      params.push(value);
    });
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Güncellenecek alan yok.' });

    await query(`UPDATE lessons SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...params, lessonId]);
    const rows = await query('SELECT * FROM lessons WHERE id = ? LIMIT 1', [lessonId]);
    return res.json({ ok: true, data: mapLesson(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel lesson patch error:', error);
    return res.status(500).json({ ok: false, error: 'Ders güncellenemedi.' });
  }
});

router.delete('/lessons/:lessonId', async (req, res) => {
  try {
    const lessonId = cleanString(req.params.lessonId);
    const exists = await query('SELECT id FROM lessons WHERE id = ? LIMIT 1', [lessonId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Ders bulunamadı.' });
    await query('DELETE FROM lessons WHERE id = ?', [lessonId]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Lingola Kids panel lesson delete error:', error);
    return res.status(500).json({ ok: false, error: 'Ders silinemedi.' });
  }
});

router.get('/activities', async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1);
    const limit = positiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const search = cleanString(req.query.search);
    const lessonId = cleanString(req.query.lessonId);

    const where = ['1=1'];
    const params = [];
    if (search) {
      where.push('(la.title LIKE ? OR la.slug LIKE ? OR la.activity_type LIKE ?)');
      const term = likeTerm(search);
      params.push(term, term, term);
    }
    if (lessonId) {
      where.push('la.lesson_id = ?');
      params.push(lessonId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM lesson_activities la ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const rows = await query(
      `SELECT la.*, l.title AS lesson_title, l.slug AS lesson_slug
       FROM lesson_activities la
       LEFT JOIN lessons l ON l.id = la.lesson_id
       ${whereSql}
       ORDER BY la.lesson_id ASC, la.sort_order ASC, la.title ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map(mapActivity),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    console.error('Lingola Kids panel activities error:', error);
    return res.status(500).json({ ok: false, error: 'Aktiviteler alınamadı.' });
  }
});

router.post('/activities', async (req, res) => {
  try {
    const body = req.body || {};
    const lessonId = cleanString(body.lessonId);
    const title = cleanString(body.title);
    const slug = cleanString(body.slug) || slugify(title);
    const activityType = cleanString(body.activityType);
    const routeName = cleanString(body.routeName);
    if (!lessonId || !title || !slug || !activityType || !routeName) {
      return res.status(400).json({ ok: false, error: 'Ders, başlık, slug, tür ve route zorunludur.' });
    }

    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const isActive = parseBool(body.isActive);
    await query(
      `INSERT INTO lesson_activities (lesson_id, slug, title, activity_type, route_name, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [lessonId, slug, title, activityType, routeName, sortOrder, isActive === false ? 0 : 1]
    );
    const rows = await query(
      `SELECT la.*, l.title AS lesson_title, l.slug AS lesson_slug
       FROM lesson_activities la
       LEFT JOIN lessons l ON l.id = la.lesson_id
       WHERE la.lesson_id = ? AND la.slug = ?
       LIMIT 1`,
      [lessonId, slug]
    );
    return res.status(201).json({ ok: true, data: mapActivity(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel activity create error:', error);
    return res.status(500).json({ ok: false, error: 'Aktivite oluşturulamadı.' });
  }
});

router.patch('/activities/:activityId', async (req, res) => {
  try {
    const activityId = cleanString(req.params.activityId);
    const exists = await query('SELECT id FROM lesson_activities WHERE id = ? LIMIT 1', [activityId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Aktivite bulunamadı.' });

    const body = req.body || {};
    const fieldMap = [
      ['lessonId', 'lesson_id'],
      ['title', 'title'],
      ['slug', 'slug'],
      ['activityType', 'activity_type'],
      ['routeName', 'route_name'],
      ['sortOrder', 'sort_order'],
      ['isActive', 'is_active'],
    ];
    const sets = [];
    const params = [];
    fieldMap.forEach(([inputKey, column]) => {
      if (body[inputKey] === undefined) return;
      if (inputKey === 'isActive') {
        const value = parseBool(body.isActive);
        if (value === null) return;
        sets.push(`${column} = ?`);
        params.push(value ? 1 : 0);
        return;
      }
      if (inputKey === 'sortOrder') {
        sets.push(`${column} = ?`);
        params.push(Number(body.sortOrder) || 0);
        return;
      }
      const value = cleanString(body[inputKey], { allowEmpty: true });
      if (value === null && !['slug'].includes(inputKey)) return;
      sets.push(`${column} = ?`);
      params.push(value);
    });
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Güncellenecek alan yok.' });

    await query(`UPDATE lesson_activities SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [
      ...params,
      activityId,
    ]);
    const rows = await query(
      `SELECT la.*, l.title AS lesson_title, l.slug AS lesson_slug
       FROM lesson_activities la
       LEFT JOIN lessons l ON l.id = la.lesson_id
       WHERE la.id = ?
       LIMIT 1`,
      [activityId]
    );
    return res.json({ ok: true, data: mapActivity(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel activity patch error:', error);
    return res.status(500).json({ ok: false, error: 'Aktivite güncellenemedi.' });
  }
});

router.delete('/activities/:activityId', async (req, res) => {
  try {
    const activityId = cleanString(req.params.activityId);
    const exists = await query('SELECT id FROM lesson_activities WHERE id = ? LIMIT 1', [activityId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Aktivite bulunamadı.' });
    await query('DELETE FROM lesson_activities WHERE id = ?', [activityId]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Lingola Kids panel activity delete error:', error);
    return res.status(500).json({ ok: false, error: 'Aktivite silinemedi.' });
  }
});

router.get('/items', async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1);
    const limit = positiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const search = cleanString(req.query.search);
    const lessonId = cleanString(req.query.lessonId);

    const where = ['1=1'];
    const params = [];
    if (search) {
      where.push('(li.label LIKE ? OR li.item_key LIKE ? OR li.asset_key LIKE ?)');
      const term = likeTerm(search);
      params.push(term, term, term);
    }
    if (lessonId) {
      where.push('li.lesson_id = ?');
      params.push(lessonId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await query(`SELECT COUNT(*) AS total FROM lesson_items li ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);

    const rows = await query(
      `SELECT li.*, l.title AS lesson_title
       FROM lesson_items li
       LEFT JOIN lessons l ON l.id = li.lesson_id
       ${whereSql}
       ORDER BY li.lesson_id ASC, li.sort_order ASC, li.label ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map(mapItem),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    console.error('Lingola Kids panel items error:', error);
    return res.status(500).json({ ok: false, error: 'Öğeler alınamadı.' });
  }
});

router.post('/items', async (req, res) => {
  try {
    const body = req.body || {};
    const lessonId = cleanString(body.lessonId);
    const itemKey = cleanString(body.itemKey);
    const label = cleanString(body.label);
    const assetKey = cleanString(body.assetKey);
    if (!lessonId || !itemKey || !label || !assetKey) {
      return res.status(400).json({ ok: false, error: 'Ders, item key, etiket ve asset key zorunludur.' });
    }

    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const drawAssetKey = cleanString(body.drawAssetKey, { allowEmpty: true });
    const metadata = body.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null;

    await query(
      `INSERT INTO lesson_items (lesson_id, item_key, label, asset_key, draw_asset_key, sort_order, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [lessonId, itemKey, label, assetKey, drawAssetKey, sortOrder, metadata]
    );
    const rows = await query(
      `SELECT li.*, l.title AS lesson_title
       FROM lesson_items li
       LEFT JOIN lessons l ON l.id = li.lesson_id
       WHERE li.lesson_id = ? AND li.item_key = ?
       LIMIT 1`,
      [lessonId, itemKey]
    );
    return res.status(201).json({ ok: true, data: mapItem(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel item create error:', error);
    return res.status(500).json({ ok: false, error: 'Öğe oluşturulamadı.' });
  }
});

router.patch('/items/:itemId', async (req, res) => {
  try {
    const itemId = cleanString(req.params.itemId);
    const exists = await query('SELECT id FROM lesson_items WHERE id = ? LIMIT 1', [itemId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Öğe bulunamadı.' });

    const body = req.body || {};
    const fieldMap = [
      ['lessonId', 'lesson_id'],
      ['itemKey', 'item_key'],
      ['label', 'label'],
      ['assetKey', 'asset_key'],
      ['drawAssetKey', 'draw_asset_key'],
      ['sortOrder', 'sort_order'],
    ];
    const sets = [];
    const params = [];
    fieldMap.forEach(([inputKey, column]) => {
      if (body[inputKey] === undefined) return;
      if (inputKey === 'sortOrder') {
        sets.push(`${column} = ?`);
        params.push(Number(body.sortOrder) || 0);
        return;
      }
      const value = cleanString(body[inputKey], { allowEmpty: true });
      if (value === null && !['drawAssetKey', 'itemKey'].includes(inputKey)) return;
      sets.push(`${column} = ?`);
      params.push(value);
    });
    if (body.metadata !== undefined) {
      sets.push('metadata = ?');
      params.push(body.metadata && typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : null);
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Güncellenecek alan yok.' });

    await query(`UPDATE lesson_items SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [
      ...params,
      itemId,
    ]);
    const rows = await query(
      `SELECT li.*, l.title AS lesson_title
       FROM lesson_items li
       LEFT JOIN lessons l ON l.id = li.lesson_id
       WHERE li.id = ?
       LIMIT 1`,
      [itemId]
    );
    return res.json({ ok: true, data: mapItem(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel item patch error:', error);
    return res.status(500).json({ ok: false, error: 'Öğe güncellenemedi.' });
  }
});

router.delete('/items/:itemId', async (req, res) => {
  try {
    const itemId = cleanString(req.params.itemId);
    const exists = await query('SELECT id FROM lesson_items WHERE id = ? LIMIT 1', [itemId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Öğe bulunamadı.' });
    await query('DELETE FROM lesson_items WHERE id = ?', [itemId]);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Lingola Kids panel item delete error:', error);
    return res.status(500).json({ ok: false, error: 'Öğe silinemedi.' });
  }
});

router.get('/languages', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM languages ORDER BY sort_order ASC, name ASC');
    return res.json({ ok: true, data: rows.map(mapLanguage) });
  } catch (error) {
    console.error('Lingola Kids panel languages error:', error);
    return res.status(500).json({ ok: false, error: 'Diller alınamadı.' });
  }
});

router.post('/languages', async (req, res) => {
  try {
    const body = req.body || {};
    const code = cleanString(body.code);
    const name = cleanString(body.name);
    if (!code || !name) return res.status(400).json({ ok: false, error: 'Kod ve ad zorunludur.' });
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const isActive = parseBool(body.isActive);
    await query(
      'INSERT INTO languages (code, name, sort_order, is_active) VALUES (?, ?, ?, ?)',
      [code, name, sortOrder, isActive === false ? 0 : 1]
    );
    const rows = await query('SELECT * FROM languages WHERE code = ? LIMIT 1', [code]);
    return res.status(201).json({ ok: true, data: mapLanguage(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel language create error:', error);
    return res.status(500).json({ ok: false, error: 'Dil oluşturulamadı.' });
  }
});

router.patch('/languages/:languageId', async (req, res) => {
  try {
    const languageId = cleanString(req.params.languageId);
    const exists = await query('SELECT id FROM languages WHERE id = ? LIMIT 1', [languageId]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Dil bulunamadı.' });

    const body = req.body || {};
    const sets = [];
    const params = [];
    if (body.code !== undefined) {
      sets.push('code = ?');
      params.push(cleanString(body.code));
    }
    if (body.name !== undefined) {
      sets.push('name = ?');
      params.push(cleanString(body.name));
    }
    if (body.sortOrder !== undefined) {
      sets.push('sort_order = ?');
      params.push(Number(body.sortOrder) || 0);
    }
    if (body.isActive !== undefined) {
      const value = parseBool(body.isActive);
      if (value !== null) {
        sets.push('is_active = ?');
        params.push(value ? 1 : 0);
      }
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Güncellenecek alan yok.' });

    await query(`UPDATE languages SET ${sets.join(', ')} WHERE id = ?`, [...params, languageId]);
    const rows = await query('SELECT * FROM languages WHERE id = ? LIMIT 1', [languageId]);
    return res.json({ ok: true, data: mapLanguage(rows[0]) });
  } catch (error) {
    console.error('Lingola Kids panel language patch error:', error);
    return res.status(500).json({ ok: false, error: 'Dil güncellenemedi.' });
  }
});

router.get('/voices', async (req, res) => {
  try {
    const page = positiveInt(req.query.page, 1);
    const limit = positiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;
    const lessonId = cleanString(req.query.lessonId);
    const language = cleanString(req.query.language);
    const search = cleanString(req.query.search);

    const where = ['1=1'];
    const params = [];
    if (lessonId) {
      where.push('lesson_id = ?');
      params.push(lessonId);
    }
    if (language) {
      where.push('language_code = ?');
      params.push(language);
    }
    if (search) {
      where.push('(voice_text LIKE ? OR cdn_key LIKE ?)');
      const term = likeTerm(search);
      params.push(term, term);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countRows = await query(`SELECT COUNT(*) AS total FROM voice_assets ${whereSql}`, params);
    const total = Number(countRows[0]?.total || 0);
    const rows = await query(
      `SELECT * FROM voice_assets ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map(mapVoice),
      pagination: pagination(page, limit, total),
    });
  } catch (error) {
    console.error('Lingola Kids panel voices error:', error);
    return res.status(500).json({ ok: false, error: 'Ses kayıtları alınamadı.' });
  }
});

module.exports = router;
