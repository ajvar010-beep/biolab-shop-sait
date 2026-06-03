/**
 * Скрипт создания администратора Biolab.
 * Запускать через create-admin.ps1 — он передаёт credentials через env vars.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const path = require('path');
const bcrypt = require('bcrypt');
const initSqlJs = require('sql.js');
const crypto = require('crypto');
const fs = require('fs');

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
  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    console.error('❌ База данных не найдена. Запустите сервер хотя бы раз.');
    process.exit(1);
  }

  const existing = db.exec(`SELECT * FROM users WHERE username = '${username.trim().replace(/'/g, "''")}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    console.log('ℹ️  Админ уже существует:', username);
    db.close();
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = 'admin_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO users (_id, username, password, role, tokenVersion, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username.trim(), hashed, 'admin', 0, now]
  );

  fs.writeFileSync(DB_PATH, db.export());
  db.close();

  console.log('✅ Админ создан:', username);
  console.log('   ID:', id);
})();
