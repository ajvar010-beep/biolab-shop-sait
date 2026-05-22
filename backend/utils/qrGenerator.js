const QRCode = require('qrcode');

/**
 * Генерирует QR-код для заказа
 * @param {string} orderNumber - Номер заказа
 * @returns {Promise<string>} Base64 строка с QR-кодом
 */
const generateQRCode = async (orderNumber) => {
  try {
    const qrData = `BIOLAB-ORDER:${orderNumber}`;
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataURL;
  } catch (error) {
    console.error('Ошибка генерации QR-кода:', error);
    throw error;
  }
};

module.exports = { generateQRCode };
