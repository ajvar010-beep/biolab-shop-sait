/**
 * Search Controller — серверный прокси автоперевода поискового запроса.
 * Переводит запрос на русский (авто-определение языка), чтобы поиск понимал
 * любой язык БЕЗ ручного словаря. Вызывается фронтендом (/api/search/translate).
 *
 * Перевод делается на сервере намеренно: у Render интернет без ограничений
 * (в отличие от браузера пользователя в РФ) и нет CORS. Ключ API не нужен.
 */
const https = require('https');

// Простой in-memory кэш переводов (на время жизни процесса)
const cache = new Map();
const CACHE_MAX = 1000;

function googleTranslate(text, to = 'ru') {
  return new Promise((resolve, reject) => {
    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(url, { timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let body = '';
      res.on('data', (c) => {
        body += c;
        if (body.length > 200000) req.destroy(new Error('too large'));
      });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          // data[0] — массив сегментов перевода; data[2] — определённый исходный язык
          const out = Array.isArray(data[0]) ? data[0].map(s => (s && s[0]) || '').join('') : '';
          resolve({ text: out.trim(), from: data[2] || '' });
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

exports.translate = async (req, res) => {
  // Убираем управляющие символы (0x00–0x1F, 0x7F), затем ограничиваем длину
  const q = String(req.query.q || '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 120);
  if (q.length < 2) return res.json({ text: '' });

  const key = q.toLowerCase();
  if (cache.has(key)) return res.json({ text: cache.get(key), cached: true });

  try {
    const { text } = await googleTranslate(q, 'ru');
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, text);
    res.json({ text });
  } catch (err) {
    // Грейсфул-деградация: фронт молча откатится на локальный поиск
    res.json({ text: '', error: true });
  }
};
