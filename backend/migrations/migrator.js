/**
 * SQLite Migrator для Biolab (local/development)
 * Методы database-sqlite.js асинхронные, поэтому миграции тоже выполняем через await.
 */
const fs = require('fs');
const path = require('path');

function loadMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    // Только SQLite-миграции: NNN_*.js, но НЕ *-pg.js (те для PostgreSQL)
    .filter(f => /^\d{3}_.*\.js$/.test(f) && !f.endsWith('-pg.js'))
    .sort();

  return files.map(f => {
    const migration = require(path.join(migrationsDir, f));
    const num = parseInt(f.match(/^(\d{3})/)[1], 10);
    return { num, name: f, ...migration };
  }).sort((a, b) => a.num - b.num);
}

async function run(db) {
  // Создаём таблицу миграций если её нет
  await db.runMigration(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Получаем уже выполненные миграции
  const applied = await db.all('SELECT id, name FROM _migrations ORDER BY id');
  const appliedIds = new Set(applied.map(m => m.id));

  const migrations = loadMigrations();
  let executed = 0;

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      console.log(`[Миграция ${migration.num}] ${migration.name} - уже выполнена, пропускаем`);
      continue;
    }

    console.log(`[Миграция ${migration.num}] Выполняем: ${migration.name}...`);

    await db.beginTransaction();
    try {
      await migration.up(db);

      await db.run('INSERT INTO _migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);

      await db.commit();
      console.log(`[Миграция ${migration.num}] ✅ Выполнена`);
      executed++;
    } catch (error) {
      await db.rollback();
      console.error(`[Миграция ${migration.num}] ❌ Ошибка: ${error.message}`);
      throw error;
    }
  }

  if (executed === 0) {
    console.log('[Миграции] Все актуальны, ничего не выполняли');
  } else {
    console.log(`[Миграции] Выполнено: ${executed}`);
  }
}

module.exports = { run };
