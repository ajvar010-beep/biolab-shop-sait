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
const { csrfCheck, authLimiter, adminLimiter, createRateLimiter, orderLookupLimiter } = require('./middleware/security');
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
  // ADMIN_PASSWORD не делаем обязательным для старта: его отсутствие не должно
  // ронять весь сайт. Если он не задан в production — просто не создаём дефолтного
  // админа (см. initAdmin). Существующий админ в БД продолжает работать.
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ ADMIN_PASSWORD не задан — дефолтный админ не будет создан (существующий в БД работает)');
  }
}
assertEnv();

const app = express();

// За обратным прокси Render/любого PaaS: доверяем первому проксирующему хопу,
// чтобы req.ip был реальным IP клиента (из X-Forwarded-For), а не адресом
// балансировщика. Без этого ВСЕ rate-лимитеры считают всех под одним IP.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ===== Конфигурация базы данных =====
const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'biolab.db');

const dbType = process.env.DATABASE_URL ? 'postgres' : 'sqlite';

// Создаём админа по умолчанию (идемпотентно). Пароль — ТОЛЬКО из env.
// В dev допускаем фолбэк для удобства; в production assertEnv уже гарантировал ADMIN_PASSWORD.
async function initAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD
    || (process.env.NODE_ENV === 'production' ? null : 'AdminDemo2026');
  if (!password) {
    console.warn('⚠️ ADMIN_PASSWORD не задан — админ по умолчанию не создан');
    return;
  }
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
      // hCaptcha требует hcaptcha.com и *.hcaptcha.com в script/style/frame/connect:
      // https://docs.hcaptcha.com/#content-security-policy-settings
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
      scriptSrcAttr: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
      fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
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

// В production со credentials:true рефлексия любого Origin ('*') опасна.
// Если ALLOWED_ORIGINS не задан на проде — предупреждаем и запрещаем кросс-оригин.
const wildcardCors = allowedOrigins.includes('*');
if (wildcardCors && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ ALLOWED_ORIGINS не задан в production — кросс-оригин запросы будут отклоняться');
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // '*' уважаем только вне production
    if (wildcardCors && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
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
// Аутентификация
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Публичные API — rate limiting для защиты от DDoS (только GET)
const productGetLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter(60 * 1000, 100, 'Слишком много запросов к каталогу. Попробуйте позже');

const categoryGetLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter(60 * 1000, 100, 'Слишком много запросов к категориям. Попробуйте позже');

const settingsGetLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter(60 * 1000, 60, 'Слишком много запросов к настройкам. Попробуйте позже');

const healthLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter(60 * 1000, 60, 'Слишком много запросов. Попробуйте позже');

app.use('/api/health', healthLimiter);

// Заказы (GET — публичный поиск по коду, POST/PUT/DELETE — защищены adminLimiter)
app.use('/api/orders', (req, res, next) => {
  if (req.method === 'GET') {
    return orderLookupLimiter(req, res, next);
  }
  return adminLimiter(req, res, next);
});

// Публичные GET endpoints
app.use('/api/products', (req, res, next) => {
  if (req.method === 'GET') return productGetLimiter(req, res, next);
  return adminLimiter(req, res, next);
});
app.use('/api/categories', (req, res, next) => {
  if (req.method === 'GET') return categoryGetLimiter(req, res, next);
  return adminLimiter(req, res, next);
});
app.use('/api/settings', (req, res, next) => {
  if (req.method === 'GET') return settingsGetLimiter(req, res, next);
  return adminLimiter(req, res, next);
});

// Управление админами и журнал действий — все методы под adminLimiter (только для своих).
app.use('/api/admins', adminLimiter);
app.use('/api/audit', adminLimiter);

// Автоперевод поиска — публичный, лимитируем (ходит во внешний сервис)
const searchLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : createRateLimiter(60 * 1000, 60, 'Слишком много запросов поиска. Попробуйте позже');
app.use('/api/search', searchLimiter);

// ===== Статика =====
const ROOT = path.resolve(__dirname, '..');

// 1. Uploads
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

// 2. PWA-файлы из public/ (manifest.json, sw.js, иконки)
const PUBLIC_DIR = path.join(ROOT, 'public');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR, { index: false }));
}

// 3. Фронтенд-статика по mount point'ам (безопасно — не отдаём backend/, .env и т.д.)
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/images', express.static(path.join(ROOT, 'images')));
app.use('/admin', express.static(path.join(ROOT, 'admin')));

// 4. Корневые файлы
app.use('/favicon.svg', express.static(path.join(ROOT, 'favicon.svg')));
app.use('/robots.txt', express.static(path.join(ROOT, 'robots.txt')));

// 4a. Sitemap — динамический, всегда свежий из БД.
// Надёжнее статического файла: на эфемерном диске Render файл не переживёт
// рестарт и устаревает при изменении каталога. Здесь он генерится на лету.
const SITE_URL = (process.env.SITE_URL || process.env.FRONTEND_URL || 'https://biolab-shop-sait.onrender.com').replace(/\/+$/, '');
function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// Нормализуем дату в формат W3C YYYY-MM-DD (требование sitemap).
// PostgreSQL отдаёт updatedAt как объект Date, SQLite — как ISO-строку: оба валидны.
function toSitemapDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}
app.get('/sitemap.xml', async (req, res) => {
  try {
    const [products, categories] = await Promise.all([
      db.find('products').catch(() => []),
      db.find('categories').catch(() => [])
    ]);
    const today = new Date().toISOString().split('T')[0];
    const urls = [{ loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0', lastmod: today }];
    for (const cat of categories) {
      const slug = cat.slug || (cat.name ? String(cat.name).toLowerCase().replace(/\s+/g, '-') : null);
      if (slug) urls.push({ loc: `${SITE_URL}/?category=${encodeURIComponent(slug)}`, changefreq: 'weekly', priority: '0.7', lastmod: today });
    }
    for (const p of products) {
      const lastmod = toSitemapDate(p.updatedAt) || today;
      urls.push({ loc: `${SITE_URL}/?product=${encodeURIComponent(p._id)}`, changefreq: 'weekly', priority: '0.8', lastmod });
    }
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const u of urls) {
      xml += `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>\n`;
    }
    xml += '</urlset>\n';
    res.type('application/xml').send(xml);
  } catch (e) {
    logError('Sitemap', e);
    res.status(500).type('text/plain').send('sitemap error');
  }
});

// 5. Главная страница — явно из корня
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ===== Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/audit', require('./routes/audit'));

// Health-check — без раскрытия версии/типа БД наружу
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 для API
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint не найден' });
});

// SPA-fallback — отдаём index.html только для «страничных» маршрутов.
// Запросы с расширением файла (.css/.js/.png/.svg/.map …) — это ассеты;
// если они не нашлись в express.static выше, это 404, а НЕ index.html.
// Иначе клиент (и Service Worker) получает 200 + HTML под URL ассета и кэширует мусор.
app.get('*', (req, res, next) => {
  if (/\.[a-zA-Z0-9]{1,8}$/.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  res.sendFile(path.join(ROOT, 'index.html'));
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

  // Graceful shutdown: сначала перестаём принимать запросы, ПОТОМ закрываем пул БД,
  // иначе запросы в полёте получат 500 из-за закрытого пула при каждом деплое.
  function shutdown(signal) {
    console.log(`\n${signal} получен, останавливаемся...`);
    server.close(async () => {
      try { await db.close(); } catch (_) {}
      process.exit(0);
    });
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