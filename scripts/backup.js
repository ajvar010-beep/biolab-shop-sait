/**
 * Скрипт бэкапа базы данных Biolab (SQLite).
 * Копирует biolab.db в backups/ с датой в имени файла.
 * Держит последние N бэкапов, старые удаляет.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'biolab.db');

const MAX_BACKUPS = parseInt(process.env.BACKUP_KEEP || '30', 10);

function log(msg) { console.log(`[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`); }

(async () => {
  // PostgreSQL (Neon) на проде бэкапится на стороне провайдера (PITR/снапшоты).
  // Файловый бэкап тут только для локальной SQLite.
  if (process.env.DATABASE_URL) {
    console.log('ℹ️  DATABASE_URL задан — используется PostgreSQL.');
    console.log('   Бэкап делается на стороне провайдера (Neon: snapshots / point-in-time restore),');
    console.log('   либо через pg_dump "$DATABASE_URL". Файловый бэкап SQLite здесь не нужен.');
    process.exit(0);
  }

  // Проверяем что база существует
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ База данных не найдена:', DB_PATH);
    process.exit(1);
  }

  // Создаём папку бэкапов
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Имя бэкапа: biolab-2026-06-03-143022.db
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `biolab-${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  // Используем .backup() из better-sqlite3 — консистентный снимок с учётом WAL
  // (простой copyFileSync терял бы незаписанные из WAL последние транзакции).
  try {
    const Database = require('better-sqlite3');
    const src = new Database(DB_PATH, { readonly: true });
    await src.backup(backupPath);
    src.close();
  } catch (err) {
    // Фолбэк: если better-sqlite3 недоступен — чекпойнт WAL и копия
    console.warn('[Backup] .backup() недоступен, копируем файл:', err.message);
    fs.copyFileSync(DB_PATH, backupPath);
  }
  const sizeKB = Math.round(fs.statSync(backupPath).size / 1024);
  console.log(`✅ Бэкап создан: ${backupName} (${sizeKB} KB)`);

  // Удаляем старые бэкапы (оставляем MAX_BACKUPS самых свежих)
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('biolab-') && f.endsWith('.db'))
    .sort()
    .reverse(); // самые свежие первыми

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`🗑  Удалён старый бэкап: ${f}`);
    }
  }

  console.log(`ℹ️  Всего бэкапов: ${backups.length} (храним ${MAX_BACKUPS})`);
})();
