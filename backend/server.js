/**
 * Biolab Server - SQLite версия
 * Бесплатный деплой без MongoDB
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

// ===== Инициализация SQLite =====
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'biolab.db');

db.init(DB_PATH);
console.log('✅ SQLite база данных инициализирована');

// Создаём админа по умолчанию если его нет
authController.createDefaultAdmin('admin', 'AdminDemo2026')
  .then(created => {
    if (created) {
      console.log('✅ Админ создан: admin / AdminDemo2026');
    } else {
      console.log('ℹ️ Админ уже существует');
    }
  })
  .catch(err => {
    console.error('⚠️ Ошибка создания админа:', err.message);
  });

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

// Public directory или fallback
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));
} else {
  app.use('/assets', express.static(path.join(ROOT, 'assets')));
  app.use('/images', express.static(path.join(ROOT, 'images')));
  app.use('/admin', express.static(path.join(ROOT, 'admin')));

  const safeFiles = ['index.html', 'favicon.ico', 'robots.txt'];
  app.get(['/', ...safeFiles.map((f) => `/${f}`)], (req, res, next) => {
    const file = req.path === '/' ? 'index.html' : req.path.slice(1);
    if (!safeFiles.includes(file)) return next();
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) return next();
    res.sendFile(fullPath);
  });
}

// ===== Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/settings', require('./routes/settings'));

// Health-check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.3.0', database: 'sqlite' });
});

// 404 для API
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint не найден' });
});

// SPA-fallback
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexPath = fs.existsSync(PUBLIC_DIR)
    ? path.join(PUBLIC_DIR, 'index.html')
    : path.join(ROOT, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
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

// Запускаем сервер только при прямом запуске (не при импорте из тестов)
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 Локальный доступ: http://localhost:${PORT}`);
    console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ База данных: SQLite (${DB_PATH})`);
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

module.exports = app;