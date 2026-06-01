const { pool } = require('../config/database');

const mapLesson = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  assetKey: row.asset_key,
  asset_key: row.asset_key,
  sortOrder: row.sort_order,
  sort_order: row.sort_order
});

const mapActivity = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  type: row.activity_type,
  activityType: row.activity_type,
  activity_type: row.activity_type,
  routeName: row.route_name,
  route_name: row.route_name,
  sortOrder: row.sort_order,
  sort_order: row.sort_order
});

const mapItem = (row) => ({
  id: row.id,
  key: row.item_key,
  itemKey: row.item_key,
  item_key: row.item_key,
  label: row.label,
  assetKey: row.asset_key,
  asset_key: row.asset_key,
  drawAssetKey: row.draw_asset_key,
  draw_asset_key: row.draw_asset_key,
  sortOrder: row.sort_order,
  sort_order: row.sort_order,
  metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
});

const getLessonsWithProgress = async (userId) => {
  const [lessons] = await pool.execute(
    `SELECT l.*,
            COALESCE(ic.item_count, 0) AS item_count,
            COALESCE(AVG(COALESCE(p.progress_percent, 0)), 0) AS progress_percent,
            MAX(p.updated_at) AS last_progress_at
     FROM lessons l
     LEFT JOIN (
       SELECT lesson_id, COUNT(*) AS item_count
       FROM lesson_items
       GROUP BY lesson_id
     ) ic ON ic.lesson_id = l.id
     LEFT JOIN lesson_activities a ON a.lesson_id = l.id AND a.is_active = 1
     LEFT JOIN user_lesson_progress p
       ON p.lesson_id = l.id AND p.activity_id = a.id AND p.user_id = ?
     WHERE l.is_active = 1
     GROUP BY l.id
     ORDER BY l.sort_order ASC`,
    [userId || 0]
  );

  return lessons.map((row) => ({
    ...mapLesson(row),
    itemCount: Number(row.item_count || 0),
    item_count: Number(row.item_count || 0),
    progress: Number(row.progress_percent || 0),
    progressPercent: Number(row.progress_percent || 0),
    progress_percent: Number(row.progress_percent || 0),
    lastProgressAt: row.last_progress_at,
    last_progress_at: row.last_progress_at
  }));
};

const getLessonDetail = async (lessonSlug, languageCode = 'en') => {
  const [lessons] = await pool.execute(
    'SELECT * FROM lessons WHERE slug = ? AND is_active = 1 LIMIT 1',
    [lessonSlug]
  );
  if (lessons.length === 0) return null;
  const lesson = lessons[0];

  const [activities] = await pool.execute(
    `SELECT * FROM lesson_activities
     WHERE lesson_id = ? AND is_active = 1
     ORDER BY sort_order ASC`,
    [lesson.id]
  );

  const [items] = await pool.execute(
    `SELECT li.*,
            va.cdn_url AS voice_cdn_url,
            va.voice_id AS voice_id
     FROM lesson_items li
     LEFT JOIN voice_assets va
       ON va.item_id = li.id AND va.language_code = ?
     WHERE li.lesson_id = ?
     ORDER BY li.sort_order ASC`,
    [languageCode, lesson.id]
  );

  return {
    ...mapLesson(lesson),
    activities: activities.map(mapActivity),
    items: items.map((row) => ({
      ...mapItem(row),
      voiceUrl: row.voice_cdn_url || null,
      voice_url: row.voice_cdn_url || null,
      voiceId: row.voice_id || null,
      voice_id: row.voice_id || null
    }))
  };
};

const findLessonAndActivity = async (lessonSlug, activitySlug) => {
  const [rows] = await pool.execute(
    `SELECT l.id AS lesson_id, l.slug AS lesson_slug, l.title AS lesson_title,
            a.id AS activity_id, a.slug AS activity_slug, a.route_name
     FROM lessons l
     JOIN lesson_activities a ON a.lesson_id = l.id
     WHERE l.slug = ? AND a.slug = ? AND l.is_active = 1 AND a.is_active = 1
     LIMIT 1`,
    [lessonSlug, activitySlug]
  );
  return rows[0] || null;
};

module.exports = {
  getLessonsWithProgress,
  getLessonDetail,
  findLessonAndActivity,
  mapLesson,
  mapActivity,
  mapItem
};
