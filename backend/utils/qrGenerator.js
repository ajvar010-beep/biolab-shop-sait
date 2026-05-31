const QRCode = require('qrcode');

/**
 * Генерирует QR-код для заказа в формате data URL.
 * @param {string} orderCode 12-значный код заказа
 * @returns {Promise<string>} data:image/png;base64,...
 */
const generateQRCode = async (orderCode) => {
  const qrData = `BIOLAB-ORDER:${orderCode}`;
  return QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
};

module.exports = { generateQRCode };
