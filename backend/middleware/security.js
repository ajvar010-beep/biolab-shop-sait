const rateLimit = require('express-rate-limit');

/**
 * Создаёт rate limiter c единым форматом ответа.
 */
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
  handler: (req, res) => {
    res.status(429).json({
      message,
      retryAfter: Math.round(windowMs / 1000)
    });
  }
});

const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  'Слишком много попыток входа. Попробуйте через 15 минут'
);

const orderLimiter = createRateLimiter(
  60 * 1000,
  5,
  'Слишком много заказов. Подождите минуту'
);

const adminLimiter = createRateLimiter(
  60 * 1000,
  60,
  'Слишком много запросов к админ-панели'
);

const orderLookupLimiter = createRateLimiter(
  60 * 1000,
  20,
  'Слишком много запросов поиска заказа'
);

/**
 * Защита от типовых NoSQL-инъекций: ключи с $ или . в req.body / req.query / req.params.
 * Простая, надёжная и без зависимостей. Ключи с операторами не пройдут.
 */
function sanitizeMongoInput(req, res, next) {
  const reject = () => res.status(400).json({ message: 'Недопустимые данные запроса' });
  const isBad = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) return true;
      const v = obj[key];
      if (v && typeof v === 'object' && isBad(v)) return true;
    }
    return false;
  };

  if (isBad(req.body) || isBad(req.query) || isBad(req.params)) return reject();
  next();
}

/**
 * Минимальная Origin-проверка для не-GET запросов: дополнительная защита от CSRF
 * поверх того, что мы храним JWT в localStorage и шлём его явно (не cookie).
 * Если Origin отсутствует (curl, Postman) и нет cookies — пропускаем (это не браузер).
 */
function checkOrigin(allowedOrigins) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const origin = req.get('Origin') || req.get('Referer');
    // Если запрос без Origin/Referer и без cookies — это явно не браузер с украденной сессией
    if (!origin && !req.headers.cookie) return next();

    if (!origin) return res.status(403).json({ message: 'Origin не указан' });

    const ok = allowedOrigins.some((o) => origin === o || origin.startsWith(o + '/'));
    if (!ok) return res.status(403).json({ message: 'Origin не разрешён' });
    next();
  };
}

module.exports = {
  authLimiter,
  orderLimiter,
  adminLimiter,
  orderLookupLimiter,
  sanitizeMongoInput,
  checkOrigin
};
