const nodemailer = require('nodemailer');

// Создание транспорта для отправки email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Отправляет email с QR-кодом заказа
 * @param {string} to - Email получателя
 * @param {string} orderNumber - Номер заказа
 * @param {string} qrCodeDataURL - Base64 QR-код
 * @param {object} orderDetails - Детали заказа
 */
const sendOrderEmail = async (to, orderNumber, qrCodeDataURL, orderDetails) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `Заказ #${orderNumber} - Биолаборатория`,
      html: `
        <h2>Спасибо за ваш заказ!</h2>
        <p>Номер заказа: <strong>${orderNumber}</strong></p>
        <p>Имя: ${orderDetails.customerName}</p>
        <p>Телефон: ${orderDetails.customerPhone}</p>

        <h3>Товары:</h3>
        <ul>
          ${orderDetails.items.map(item => `
            <li>${item.title} - ${item.quantity} шт. × ${item.price} ₽ = ${item.quantity * item.price} ₽</li>
          `).join('')}
        </ul>

        <p><strong>Итого: ${orderDetails.totalAmount} ₽</strong></p>

        <h3>QR-код для получения заказа:</h3>
        <p>Покажите этот QR-код при получении товара в теплице:</p>
        <img src="${qrCodeDataURL}" alt="QR-код заказа" style="display: block; margin: 20px 0;" />

        <p style="color: #666; font-size: 14px;">
          Оплата производится при получении товара (наличные или перевод).
        </p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email отправлен на ${to}`);
  } catch (error) {
    console.error('Ошибка отправки email:', error);
    throw error;
  }
};

module.exports = { sendOrderEmail };
