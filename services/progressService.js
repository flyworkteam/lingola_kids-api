const { pool } = require('../config/database');
const { findLessonAndActivity } = require('./lessonCatalogService');

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const parseClientEventAt = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const mapProgress = (row) => ({
  id: row.id,
  lessonSlug: row.lesson_slug,
  lesson_slug: row.lesson_slug,
  lessonTitle: row.lesson_title,
  lesson_title: row.lesson_title,
  activitySlug: row.activity_slug,
  activity_slug: row.activity_slug,
  activityTitle: row.activity_title,
  activity_title: row.activity_title,
  routeName: row.route_name,
  route_name: row.route_name,
  currentItemIndex: row.current_item_index,
  current_item_index: row.current_item_index,
  currentItemKey: row.current_item_key,
  current_item_key: row.current_item_key,
  progressPercent: Number(row.progress_percent || 0),
  progress_percent: Number(row.progress_percent || 0),
  status: row.status,
  attempts: row.attempts,
  correctCount: row.correct_count,
  correct_count: row.correct_count,
  lastAnswerCorrect: row.last_answer_correct == null ? null : !!row.last_answer_correct,
  last_answer_correct: row.last_answer_correct == null ? null : !!row.last_answer_correct,
  resumePayload: parseJson(row.resume_payload),
  resume_payload: parseJson(row.resume_payload),
  clientEventAt: row.client_event_at,
  client_event_at: row.client_event_at,
  updatedAt: row.updated_at,
  updated_at: row.updated_at
});

const upsertProgress = async ({ userId, lessonSlug, activitySlug, body }) => {
  const target = await findLessonAndActivity(lessonSlug, activitySlug);
  if (!target) {
    const error = new Error('Lesson activity not found');
    error.statusCode = 404;
    throw error;
  }

  const routeName = body.routeName || body.route_name || target.route_name;
  const currentItemIndex = body.currentItemIndex ?? body.current_item_index ?? 0;
  const currentItemKey = body.currentItemKey ?? body.current_item_key ?? null;
  const progressPercent = body.progressPercent ?? body.progress_percent ?? 0;
  const status = body.status || (Number(progressPercent) >= 100 ? 'completed' : 'in_progress');
  const attempts = body.attempts ?? 0;
  const correctCount = body.correctCount ?? body.correct_count ?? 0;
  const lastAnswerCorrect = body.lastAnswerCorrect ?? body.last_answer_correct ?? null;
  const resumePayload = body.resumePayload ?? body.resume_payload ?? null;
  const clientEventAt = parseClientEventAt(body.clientEventAt || body.client_event_at);

  await pool.execute(
    `INSERT INTO user_lesson_progress (
       user_id, lesson_id, activity_id, route_name, current_item_index, current_item_key,
       progress_percent, status, attempts, correct_count, last_answer_correct, resume_payload, client_event_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       route_name = IF(status = 'completed', route_name, VALUES(route_name)),
       current_item_index = IF(status = 'completed', current_item_index, VALUES(current_item_index)),
       current_item_key = IF(status = 'completed', current_item_key, VALUES(current_item_key)),
       progress_percent = GREATEST(progress_percent, VALUES(progress_percent)),
       status = IF(status = 'completed', status, VALUES(status)),
       attempts = GREATEST(attempts, VALUES(attempts)),
       correct_count = GREATEST(correct_count, VALUES(correct_count)),
       last_answer_correct = VALUES(last_answer_correct),
       resume_payload = VALUES(resume_payload),
       client_event_at = VALUES(client_event_at)`,
    [
      userId,
      target.lesson_id,
      target.activity_id,
      routeName,
      currentItemIndex,
      currentItemKey,
      progressPercent,
      status,
      attempts,
      correctCount,
      lastAnswerCorrect,
      JSON.stringify(resumePayload),
      clientEventAt
    ]
  );

  const [rows] = await pool.execute(
    `SELECT p.*, l.slug AS lesson_slug, l.title AS lesson_title,
            a.slug AS activity_slug, a.title AS activity_title
     FROM user_lesson_progress p
     JOIN lessons l ON l.id = p.lesson_id
     JOIN lesson_activities a ON a.id = p.activity_id
     WHERE p.user_id = ? AND p.lesson_id = ? AND p.activity_id = ?`,
    [userId, target.lesson_id, target.activity_id]
  );

  return mapProgress(rows[0]);
};

const getCurrentProgress = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT p.*, l.slug AS lesson_slug, l.title AS lesson_title,
            a.slug AS activity_slug, a.title AS activity_title
     FROM user_lesson_progress p
     JOIN lessons l ON l.id = p.lesson_id
     JOIN lesson_activities a ON a.id = p.activity_id
     WHERE p.user_id = ? AND p.status IN ('not_started', 'in_progress')
     ORDER BY p.updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] ? mapProgress(rows[0]) : null;
};

const getProgressSummary = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT p.*, l.slug AS lesson_slug, l.title AS lesson_title,
            a.slug AS activity_slug, a.title AS activity_title
     FROM user_lesson_progress p
     JOIN lessons l ON l.id = p.lesson_id
     JOIN lesson_activities a ON a.id = p.activity_id
     WHERE p.user_id = ?
     ORDER BY l.sort_order ASC, a.sort_order ASC`,
    [userId]
  );
  return rows.map(mapProgress);
};

const recordEvent = async ({ userId, body }) => {
  const lessonSlug = body.lessonSlug || body.lesson_slug;
  const activitySlug = body.activitySlug || body.activity_slug;
  const target = await findLessonAndActivity(lessonSlug, activitySlug);
  if (!target) {
    const error = new Error('Lesson activity not found');
    error.statusCode = 404;
    throw error;
  }

  const idempotencyKey = body.idempotencyKey || body.idempotency_key || null;
  const eventType = body.eventType || body.event_type;
  const itemKey = body.itemKey || body.item_key || null;
  const itemIndex = body.itemIndex ?? body.item_index ?? null;
  const isCorrect = body.isCorrect ?? body.is_correct ?? null;
  const clientEventAt = parseClientEventAt(body.clientEventAt || body.client_event_at);

  await pool.execute(
    `INSERT IGNORE INTO user_activity_events (
       user_id, lesson_id, activity_id, idempotency_key, event_type, item_key, item_index,
       answer, is_correct, payload, client_event_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      target.lesson_id,
      target.activity_id,
      idempotencyKey,
      eventType,
      itemKey,
      itemIndex,
      body.answer || null,
      isCorrect,
      JSON.stringify(body.payload || null),
      clientEventAt
    ]
  );

  return { recorded: true };
};

module.exports = {
  upsertProgress,
  getCurrentProgress,
  getProgressSummary,
  recordEvent
};
