const crypto = require('crypto');
const { pool } = require('../config/database');
const { generateSpeech } = require('./elevenLabsService');
const { uploadVoiceBuffer } = require('./bunnyVoiceService');

const contentHashFor = ({ text, languageCode, voiceId }) => {
  return crypto
    .createHash('sha256')
    .update(`${languageCode}:${voiceId}:${text}`)
    .digest('hex')
    .slice(0, 24);
};

const resolveVoiceAssets = async ({ languageCode, lessonSlug, itemKeys }) => {
  const keys = itemKeys.filter(Boolean);
  if (keys.length === 0) return [];

  const placeholders = keys.map(() => '?').join(',');
  const filters = [languageCode, ...keys];
  const lessonClause = lessonSlug ? 'AND l.slug = ?' : '';
  if (lessonSlug) filters.push(lessonSlug);

  const [rows] = await pool.execute(
    `SELECT li.item_key, li.label, l.slug AS lesson_slug, va.*
     FROM lesson_items li
     JOIN lessons l ON l.id = li.lesson_id
     LEFT JOIN voice_assets va ON va.item_id = li.id AND va.language_code = ?
     WHERE li.item_key IN (${placeholders})
       ${lessonClause}
     ORDER BY li.sort_order ASC`,
    filters
  );

  return rows.map((row) => ({
    itemKey: row.item_key,
    item_key: row.item_key,
    label: row.label,
    lessonSlug: row.lesson_slug,
    lesson_slug: row.lesson_slug,
    voiceUrl: row.cdn_url || null,
    voice_url: row.cdn_url || null,
    cdnKey: row.cdn_key || null,
    cdn_key: row.cdn_key || null,
    voiceId: row.voice_id || null,
    voice_id: row.voice_id || null
  }));
};

const generateMissingVoices = async ({ languageCode, lessonSlug, itemKeys, voiceId }) => {
  const selectedVoiceId = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  const filters = [languageCode, lessonSlug];
  let itemClause = '';
  if (itemKeys && itemKeys.length > 0) {
    itemClause = `AND li.item_key IN (${itemKeys.map(() => '?').join(',')})`;
    filters.push(...itemKeys);
  }

  const [items] = await pool.execute(
    `SELECT l.id AS lesson_id, l.slug AS lesson_slug, li.id AS item_id, li.item_key, li.label
     FROM lessons l
     JOIN lesson_items li ON li.lesson_id = l.id
     LEFT JOIN voice_assets va
       ON va.item_id = li.id AND va.language_code = ? AND va.voice_id = ?
     WHERE l.slug = ? ${itemClause} AND va.id IS NULL
     ORDER BY li.sort_order ASC`,
    [languageCode, selectedVoiceId, ...filters.slice(1)]
  );

  const generated = [];
  for (const item of items) {
    const text = item.label;
    const contentHash = contentHashFor({ text, languageCode, voiceId: selectedVoiceId });
    const cdnKey = `voices/${languageCode}/${selectedVoiceId}/${item.lesson_slug}/${item.item_key}-${contentHash}.mp3`;
    const audioBuffer = await generateSpeech({ text, voiceId: selectedVoiceId, languageCode });
    const cdnUrl = await uploadVoiceBuffer({ buffer: audioBuffer, cdnKey });

    await pool.execute(
      `INSERT INTO voice_assets (
         lesson_id, item_id, language_code, voice_id, voice_text, content_hash,
         cdn_key, cdn_url, mime_type, byte_size
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'audio/mpeg', ?)
       ON DUPLICATE KEY UPDATE cdn_url = VALUES(cdn_url), byte_size = VALUES(byte_size)`,
      [
        item.lesson_id,
        item.item_id,
        languageCode,
        selectedVoiceId,
        text,
        contentHash,
        cdnKey,
        cdnUrl,
        audioBuffer.length
      ]
    );

    generated.push({
      itemKey: item.item_key,
      item_key: item.item_key,
      label: item.label,
      cdnKey,
      cdn_key: cdnKey,
      cdnUrl,
      cdn_url: cdnUrl
    });
  }

  return generated;
};

module.exports = {
  resolveVoiceAssets,
  generateMissingVoices
};
