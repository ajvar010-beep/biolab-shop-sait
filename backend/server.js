/**
 * Biolab Server
 * Поддерживает SQLite (локально) и PostgreSQL (production на Render)
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const db = require('./config/database');
const { logError } = require('./utils/logger');
const { csrfCheck, authLimiter, adminLimiter } = require('./middleware/security');
const authController = require('./controllers/authController');

// ===== Проверка критичных переменных =====
function assertEnv() {
  const errors = [];
  if (!process.env.JWT_SECRET) errors.push('JWT_SECRET не задан');
  else if (process.env.JWT_SECRET.length < 16) errors.push('JWT_SECRET слишком короткий (минимум 16 символов)');
  if (errors.length) {
    console.error('❌ Ошибки конфигурации:');
    errors.forEach((e) => console.error('   -', e));
    process.exit(1);
  }
}
assertEnv();

const app = express();

// ===== Конфигурация базы данных =====
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'biolab.db');

const dbType = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

// Создаём админа по умолчанию (идемпотентно). Логин/пароль — из env с фолбэком.
async function initAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'AdminDemo2026';
  try {
    const created = await authController.createDefaultAdmin(username, password);
    console.log(created ? `✅ Админ создан: ${username}` : 'ℹ️ Админ уже существует');
  } catch (err) {
    console.error('⚠️ Ошибка создания админа:', err.message);
  }
}

// Полная инициализация БД: подключение → миграции (создание таблиц) → админ.
// Вызывается из bootstrap() внизу файла, ДО app.listen().
async function initDatabase() {
  db.init(DB_PATH);
  await db.runMigrations();
  console.log(`🗄️ База данных готова (${dbType})`);
  await initAdmin();
}

// ===== Безопасность заголовков =====
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      scriptSrcAttr: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false
}));

// ===== CORS =====
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Не разрешено CORS политикой'));
  },
  credentials: true
};
app.use(cors(corsOptions));

// ===== Парсеры =====
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// ===== HTTP → HTTPS редирект (для VPS, не для Render где SSL терминируется) =====
app.use((req, res, next) => {
  if (req.secure || req.get('X-Forwarded-Proto') === 'https') return next();
  if (process.env.NODE_ENV === 'production' && req.protocol === 'http') {
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
});

app.use(cookieParser());

// ===== Rate limiting =====
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/products', (req, res, next) => {
  if (req.method === 'GET') return next();
  return adminLimiter(req, res, next);
});
app.use('/api/categories', (req, res, next) => {
  if (req.method === 'GET') return next();
  return adminLimiter(req, res, next);
});
app.use('/api/orders', (req, res, next) => {
  if (req.method === 'GET') return next();
  return adminLimiter(req, res, next);
});
app.use('/api/settings', (req, res, next) => {
  if (req.method === 'GET') return next();
  return adminLimiter(req, res, next);
});

// ===== Статика =====
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Uploads
const uploadsDir = path.join(ROOT, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Фронтенд магазина (HTML, PWA-файлы, manifest.json, sw.js) — из public/
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

// Фронтенд магазина и админки — из корня репозитория, по белому списку
// (не отдаём backend/, .env и прочие служебные файлы).
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/images', express.static(path.join(ROOT, 'images')));
app.use('/admin', express.static(path.join(ROOT, 'admin')));

// Корневые файлы (favicon.ico, favicon.svg, robots.txt) — ищем сначала в public/, потом в корне
const safeFiles = ['favicon.ico', 'favicon.svg', 'robots.txt'];
app.get(safeFiles.map((f) => `/${f}`), (req, res, next) => {
  const file = req.path.slice(1);
  if (!safeFiles.includes(file)) return next();
  const publicPath = path.join(PUBLIC_DIR, file);
  if (fs.existsSync(publicPath)) return res.sendFile(publicPath);
  const rootPath = path.join(ROOT, file);
  if (fs.existsSync(rootPath)) return res.sendFile(rootPath);
  next();
});

// ===== Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/settings', require('./routes/settings'));

// Health-check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.3.0', database: dbType });
});

// 404 для API
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint не найден' });
});

// SPA-fallback — на любой GET отдаём главную магазина (ищем в public/)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const publicIndex = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  const rootIndex = path.join(ROOT, 'index.html');
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  next();
});

// 404 универсальный
app.use((req, res) => {
  res.status(404).json({ message: 'Не найдено' });
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
  logError('Server', error);
  if (error.message === 'Не разрешено CORS политикой') {
    return res.status(403).json({ message: 'CORS ошибка' });
  }
  res.status(error.statusCode || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Внутренняя ошибка сервера'
      : error.message
  });
});

const PORT = process.env.PORT || 3000;

// Запуск: сначала готовим БД (миграции + админ), ТОЛЬКО потом слушаем порт,
// чтобы первые запросы не попали в пустую базу.
async function bootstrap() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Локальный доступ: http://localhost:${PORT}`);
    console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ База данных: ${dbType}`);
  });

  // Graceful shutdown
  function shutdown(signal) {
    console.log(`\n${signal} получен, останавливаемся...`);
    db.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Прямой запуск (npm start). В тестах БД поднимает tests/setup.js — bootstrap не нужен.
if (require.main === module && process.env.NODE_ENV !== 'test') {
  bootstrap();
}

module.exports = app;