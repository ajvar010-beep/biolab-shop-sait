const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * CSRF-токены: double-submit cookie + Authorization header.
 * Работает так:
 * 1. GET /api/auth/csrf-token — выдаёт токен (публичный, для логина)
 * 2. При логине — токен сохраняется в localStorage
 * 3. Все мутации шлют X-CSRF-Token header
 * 4. Сервер сверяет header с cookie
 */
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  });
}

function setCsrfHeaders(res, token) {
  setCsrfCookie(res, token);
  res.setHeader(CSRF_HEADER, token);
}

// Публичный endpoint — выдаёт токен (для логина и GET-страниц)
function csrfTokenIssue(req, res) {
  const token = generateToken();
  setCsrfHeaders(res, token);
  res.json({ csrfToken: token });
}

// Проверка CSRF для защищённых мутаций
function csrfCheck(req, res, next) {
  // Пропускаем всё кроме мутаций
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE] : undefined;
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ message: 'CSRF token missing' });
  }

  if (cookieToken !== headerToken) {
    return res.status(403).json({ message: 'CSRF token mismatch' });
  }

  // Ротируем токен
  const newToken = generateToken();
  setCsrfHeaders(res, newToken);
  next();
}

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
 * Минимальная Origin-проверка для не-GET запросов: дополнительная защита от CSRF
 * поверх того, что мы храним JWT в localStorage и шлём его явно (не cookie).
 * Если Origin отсутствует (curl, Postman) и нет cookies — пропускаем (это не браузер).
 */
function checkOrigin(allowedOrigins) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const origin = req.get('Origin') || req.get('Referer');
    // Если нет Origin и нет сессионного cookie (adminToken) — это curl/Postman, пропускаем.
    // CSRF-cookie (csrf_token) шлёт и curl, поэтому проверяем именно сессию.
    const hasSession = req.cookies && !!req.cookies['adminToken'];
    if (!origin && !hasSession) return next();

    if (!origin) return res.status(403).json({ message: 'Origin не указан' });

    const ok = allowedOrigins.some((o) => origin === o || origin.startsWith(o + '/'));
    if (!ok) return res.status(403).json({ message: 'Origin не разрешён' });
    next();
  };
}

module.exports = {
  csrfTokenIssue,
  csrfCheck,
  authLimiter,
  orderLimiter,
  adminLimiter,
  orderLookupLimiter,
  checkOrigin
};
