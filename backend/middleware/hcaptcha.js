/**
 * hCaptcha middleware — защита от ботов на формах заказа
 * https://docs.hcaptcha.com/
 */
const https = require('https');
const querystring = require('querystring');

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET;

/**
 * Проверить hCaptcha токен.
 * @param {string} token - h-captcha-response из формы
 * @returns {Promise<boolean>}
 */
function verifyHcaptcha(token) {
  return new Promise((resolve, reject) => {
    if (!HCAPTCHA_SECRET) {
      // Режим отключения: пропускаем без проверки
      if (process.env.NODE_ENV === 'development') {
        console.warn('[hCaptcha] HCAPTCHA_SECRET не задан, пропускаем в dev-режиме');
        return resolve(true);
      }
      return reject(new Error('hCaptcha не настроен'));
    }

    if (!token) {
      return reject(new Error('hCaptcha token отсутствует'));
    }

    const postData = querystring.stringify({
      response: token,
      secret: HCAPTCHA_SECRET
    });

    const options = {
      hostname: 'hcaptcha.com',
      port: 443,
      path: '/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result.success === true);
        } catch {
          reject(new Error('Невалидный ответ от hCaptcha'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`hCaptcha ошибка: ${err.message}`)));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('hCaptcha таймаут'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Express middleware — проверяет hCaptcha token из body.hcaptchaToken
 */
function hcaptchaMiddleware(req, res, next) {
  const token = req.body && (req.body['h-captcha-response'] || req.body.hcaptchaToken);

  verifyHcaptcha(token)
    .then((success) => {
      if (!success) {
        return res.status(400).json({ message: 'hCaptcha проверка не пройдена. Попробуйте ещё раз.' });
      }
      next();
    })
    .catch((err) => {
      console.error('[hCaptcha]', err.message);
      res.status(400).json({ message: err.message });
    });
}

module.exports = { verifyHcaptcha, hcaptchaMiddleware };
