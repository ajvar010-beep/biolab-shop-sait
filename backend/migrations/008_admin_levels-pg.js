/**
 * PostgreSQL миграция 008: Уровни доступа админов + журнал действий.
 * Зеркало 008_admin_levels.js для прода. Подробности — там.
 *
 * users.level: 1 = обычный админ, 2 = менеджер, 3 = владелец.
 * Все аккаунты, созданные до уровней, становятся Владельцами (3).
 */
module.exports = {
  id: 8,
  name: '008_admin_levels',

  async up(db) {
    // 1. Колонка level в users (PG поддерживает IF NOT EXISTS)
    await db.runMigration('ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1');

    // 2. Существующие аккаунты → Владельцы
    await db.runMigration('UPDATE users SET level = 3 WHERE level IS NULL OR level = 1');

    // 3. Журнал действий
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS audit_log (
        _id VARCHAR(255) PRIMARY KEY,
        actorId VARCHAR(255),
        actorName VARCHAR(255),
        actorLevel INTEGER,
        action VARCHAR(100) NOT NULL,
        targetType VARCHAR(50),
        targetId VARCHAR(255),
        targetLabel TEXT,
        details TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.runMigration('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (createdAt)');
    await db.runMigration('CREATE INDEX IF NOT EXISTS idx_audit_actor_level ON audit_log (actorLevel)');

    console.log('[Миграция 008] Уровни админов + журнал действий созданы (PostgreSQL)');
  }
};
