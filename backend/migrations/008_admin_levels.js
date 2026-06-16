/**
 * SQLite миграция 008: Уровни доступа админов + журнал действий.
 *
 * - users.level: 1 = обычный админ (выкладывать товары, принимать/отклонять заказы),
 *   2 = менеджер (править товары/категории/настройки, видеть журнал ур.1, управлять ур.1),
 *   3 = владелец (всё + создавать/удалять/повышать аккаунты, видеть журнал ур.1 и 2).
 * - audit_log: кто (actorId/Name/Level), что (action), над чем (targetType/Id/Label), детали.
 *   Имя и уровень актора хранятся снимком — история не теряется при удалении аккаунта.
 *
 * Все, кто существовал ДО появления уровней, становятся Владельцами (3), чтобы текущий
 * админ не потерял доступ. Idempotent: ADD COLUMN — только если колонки ещё нет.
 */
module.exports = {
  id: 8,
  name: '008_admin_levels',

  async up(db) {
    // 1. Колонка level в users (если ещё не добавлена)
    const cols = await db.all('PRAGMA table_info(users)');
    const hasLevel = cols.some(c => c.name === 'level');
    if (!hasLevel) {
      await db.runMigration('ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1');
    }

    // 2. Существующие аккаунты (созданные до уровней) → Владельцы
    await db.runMigration('UPDATE users SET level = 3 WHERE level IS NULL OR level = 1');

    // 3. Журнал действий
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS audit_log (
        _id TEXT PRIMARY KEY,
        actorId TEXT,
        actorName TEXT,
        actorLevel INTEGER,
        action TEXT NOT NULL,
        targetType TEXT,
        targetId TEXT,
        targetLabel TEXT,
        details TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runMigration('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt)');
    await db.runMigration('CREATE INDEX IF NOT EXISTS idx_audit_actor_level ON audit_log(actorLevel)');

    console.log('[Миграция 008] Уровни админов + журнал действий созданы');
  }
};
