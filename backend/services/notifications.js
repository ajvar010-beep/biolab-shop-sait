/**
 * Сервис уведомлений для Biolab Shop
 * Поддерживает Telegram-бота для отправки уведомлений админу
 */
const https = require('https');

// Telegram настройки
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Отправить сообщение в Telegram
 * @param {string} text - текст сообщения
 * @returns {Promise<boolean>} - успешно ли отправлено
 */
async function sendTelegramMessage(text) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.log('[Notifications] Telegram не настроен (TELEGRAM_BOT_TOKEN или TELEGRAM_ADMIN_CHAT_ID не заданы)');
    return false;
  }

  const data = JSON.stringify({
    chat_id: ADMIN_CHAT_ID,
    text,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.ok) {
            console.log('[Notifications] Telegram: сообщение отправлено');
            resolve(true);
          } else {
            console.error('[Notifications] Telegram ошибка:', response.description);
            resolve(false);
          }
        } catch {
          console.error('[Notifications] Telegram: не удалось распарсить ответ');
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Notifications] Telegram: ошибка сети:', err.message);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.warn('[Notifications] Telegram: таймаут');
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Отправить уведомление о новом заказе
 * @param {Object} order - данные заказа
 */
async function notifyNewOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.map(i => `  • ${i.title} x${i.quantity} — ${i.price}₽`).join('\n');

  const message = `
🛒 <b>Новый заказ!</b>

📋 Код: <code>${order.orderCode}</code>
👤 ${order.customerName}
📞 ${order.customerPhone}
${order.customerEmail ? `📧 ${order.customerEmail}` : ''}
💰 Итого: <b>${order.totalAmount}₽</b>

<b>Товары:</b>
${itemsText || '—'}

⏰ ${new Date().toLocaleString('ru-RU')}
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * Отправить уведомление о выдаче заказа
 * @param {Object} order - данные заказа
 */
async function notifyOrderCompleted(order) {
  const message = `
✅ <b>Заказ выдан!</b>

📋 Код: <code>${order.orderCode}</code>
👤 ${order.customerName}
💰 Сумма: <b>${order.totalAmount}₽</b>

⏰ Выдан: ${new Date().toLocaleString('ru-RU')}
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * Отправить уведомление об отмене заказа
 * @param {Object} order - данные заказа
 */
async function notifyOrderCancelled(order) {
  const reason = order.cancelReason ? `\n📝 Причина: ${order.cancelReason}` : '';
  const message = `
❌ <b>Заказ отменён!</b>

📋 Код: <code>${order.orderCode}</code>
👤 ${order.customerName}
💰 Сумма: ${order.totalAmount}₽${reason}

⏰ Отменён: ${new Date().toLocaleString('ru-RU')}
  `.trim();

  await sendTelegramMessage(message);
}

/**
 * Проверить настройки Telegram
 * @returns {boolean}
 */
function isConfigured() {
  return Boolean(BOT_TOKEN && ADMIN_CHAT_ID);
}

/**
 * Получить информацию о боте (для диагностики)
 */
async function getBotInfo() {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN не задан' };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/getMe`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ ok: false, error: 'Не удалось распарсить ответ' });
        }
      });
    });

    req.on('error', () => resolve({ ok: false, error: 'Ошибка сети' }));
    req.end();
  });
}

module.exports = {
  notifyNewOrder,
  notifyOrderCompleted,
  notifyOrderCancelled,
  isConfigured,
  getBotInfo
};
