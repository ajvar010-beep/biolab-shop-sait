/**
 * Скрипт создания администратора Biolab.
 * Работает с активной БД через общий адаптер (SQLite локально или PostgreSQL по DATABASE_URL).
 * Credentials передаются через env: BIOLAB_ADMIN_USERNAME / BIOLAB_ADMIN_PASSWORD.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../backend/config/database');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'biolab.db');

const BCRYPT_ROUNDS = 12;
const username = process.env.BIOLAB_ADMIN_USERNAME;
const password = process.env.BIOLAB_ADMIN_PASSWORD;

function isString(v) { return typeof v === 'string'; }
function validateUsername(u) {
  if (!isString(u)) return 'Логин обязателен';
  const t = u.trim();
  if (t.length < 3 || t.length > 32) return 'Логин: от 3 до 32 символов';
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return 'Логин: только латиница, цифры, _ и -';
  return null;
}
function validatePassword(p) {
  if (!isString(p)) return 'Пароль обязателен';
  if (p.length < 8) return 'Пароль: минимум 8 символов';
  return null;
}

const userErr = validateUsername(username);
if (userErr) { console.error('❌', userErr); process.exit(1); }

const passErr = validatePassword(password);
if (passErr) { console.error('❌', passErr); process.exit(1); }

(async () => {
  try {
    db.init(DB_PATH);
    if (db.runMigrations) await db.runMigrations();

    const existing = await db.findOne('users', { username: username.trim() });
    if (existing) {
      console.log('ℹ️  Админ уже существует:', username);
      await db.close();
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = 'admin_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await db.insert('users', {
      _id: id,
      username: username.trim(),
      password: hashed,
      role: 'admin',
      tokenVersion: 0
    });

    await db.close();
    console.log('✅ Админ создан:', username);
    console.log('   ID:', id);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
})();
