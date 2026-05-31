const nodemailer = require('nodemailer');

let transporter = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true'
    && !!process.env.EMAIL_HOST
    && !!process.env.EMAIL_USER
    && !!process.env.EMAIL_PASS;
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailEnabled()) return null;

  const port = Number(process.env.EMAIL_PORT) || 465;
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    requireTLS: !secure,  // STARTTLS на 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  return transporter;
}

/**
 * Отправляет email с подтверждением заказа и QR-кодом.
 * Если email не настроен — тихо возвращает false (не валит создание заказа).
 */
async function sendOrderEmail(to, order, qrCodeDataURL) {
  const t = getTransporter();
  if (!t || !to) return false;

  const itemsHtml = order.items.map((item) => `
    <li>${escapeHtml(item.title)} — ${item.quantity} шт. × ${item.price} ₽ = ${item.quantity * item.price} ₽</li>
  `).join('');

  const html = `
    <h2>Спасибо за заказ!</h2>
    <p>Номер заказа: <strong>${escapeHtml(order.orderCode)}</strong></p>
    <p>Имя: ${escapeHtml(order.customerName)}</p>
    <p>Телефон: ${escapeHtml(order.customerPhone)}</p>

    <h3>Товары:</h3>
    <ul>${itemsHtml}</ul>

    <p><strong>Итого: ${order.totalAmount} ₽</strong></p>

    ${qrCodeDataURL ? `
      <h3>QR-код для получения:</h3>
      <p>Покажите его в теплице:</p>
      <img src="${qrCodeDataURL}" alt="QR-код заказа" style="display:block;margin:20px 0;" />
    ` : ''}

    <p style="color:#666;font-size:14px;">Оплата при получении (наличные или перевод).</p>
  `;

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: `Заказ #${order.orderCode} — Биолаборатория`,
      html
    });
    return true;
  } catch (err) {
    console.error('Ошибка отправки email:', err.message);
    return false;
  }
}

module.exports = { sendOrderEmail, isEmailEnabled };
