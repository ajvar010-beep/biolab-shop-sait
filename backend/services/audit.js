/**
 * Сервис журнала действий (audit log).
 *
 * log(req, {...}) — записывает действие в audit_log. Best-effort: любая ошибка
 *   гасится (журнал не должен ронять основную операцию). Имя и уровень актора
 *   сохраняются снимком, чтобы история читалась даже после удаления аккаунта.
 *
 * list({viewerLevel, limit, offset}) — записи действий тех, кто СТРОГО НИЖЕ зрителя
 *   (ур.2 видит действия ур.1; ур.3 — ур.1 и 2). Сортировка от новых к старым.
 */
const crypto = require('crypto');
const db = require('../config/database');

async function log(req, { action, targetType = null, targetId = null, targetLabel = null, details = null } = {}) {
  try {
    if (!action) return;
    const actor = (req && req.admin) || {};
    await db.insert('audit_log', {
      _id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
      actorId: actor._id || null,
      actorName: actor.username || null,
      actorLevel: Number(actor.level) || null,
      action: String(action),
      targetType: targetType ? String(targetType) : null,
      targetId: targetId ? String(targetId) : null,
      targetLabel: targetLabel != null ? String(targetLabel).slice(0, 300) : null,
      details: details == null ? null : (typeof details === 'string' ? details : JSON.stringify(details)),
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    // Журнал не критичен для пользовательского действия — только логируем в консоль.
    console.error('[audit] Не удалось записать действие:', err.message);
  }
}

async function list({ viewerLevel, limit = 100, offset = 0 } = {}) {
  const lvl = Number(viewerLevel) || 1;
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  // Зритель видит только действия СТРОГО НИЖЕ своего уровня. Пагинация — на стороне БД,
  // поэтому SQL собираем под активный диалект (PG использует $n, SQLite — ?).
  const isPg = !!process.env.DATABASE_URL;
  const sql = isPg
    ? 'SELECT * FROM audit_log WHERE actorLevel < $1 ORDER BY createdAt DESC LIMIT $2 OFFSET $3'
    : 'SELECT * FROM audit_log WHERE actorLevel < ? ORDER BY createdAt DESC LIMIT ? OFFSET ?';

  return db.all(sql, [lvl, lim, off]);
}

module.exports = { log, list };
