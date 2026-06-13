/**
 * Settings Controller — поддерживает SQLite и PostgreSQL
 */
const db = require('../config/database');

const ALLOWED_PLATFORMS = ['vk', 'telegram', 'whatsapp', 'instagram', 'facebook', 'youtube', 'tiktok', 'odnoklassniki', 'website', 'email', 'phone', 'other'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s().-]{5,30}$/;

function validateUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.length > 500) return null;
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return null;
  return trimmed;
}

function sanitizeText(s, maxLen) {
  return String(s || '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

// Получить или создать настройки по умолчанию
async function getOrCreateSettings() {
  let settings = await db.findOne('settings', { _id: 'main' });
  if (!settings) {
    const defaultSettings = {
      _id: 'main',
      email: 'almetevskbiolab@gmail.com',
      phone: '',
      address: '',
      workingHours: '',
      socials: JSON.stringify([]),
      aboutText: 'Школьная биолаборатория. Выращиваем растения в собственной теплице, проводим исследовательские проекты и продаём саженцы по доступным ценам.',
      updatedAt: new Date().toISOString()
    };
    await db.insert('settings', defaultSettings);
    settings = defaultSettings;
  }
  return settings;
}

// Парсим socials если строка
function parseSettings(s) {
  const parsed = { ...s };
  if (parsed.socials && typeof parsed.socials === 'string') {
    try { parsed.socials = JSON.parse(parsed.socials); } catch (_) { parsed.socials = []; }
  }
  return parsed;
}

// GET /api/settings - публичный
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const parsed = parseSettings(settings);
    res.json({
      email: parsed.email,
      phone: parsed.phone,
      address: parsed.address,
      workingHours: parsed.workingHours,
      socials: parsed.socials || [],
      aboutText: parsed.aboutText
    });
  } catch (error) {
    console.error('Ошибка получения настроек:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// PUT /api/settings - только админ
exports.updateSettings = async (req, res) => {
  try {
    const body = req.body || {};
    const errors = [];

    // Получаем текущие
    let settings = await getOrCreateSettings();
    const current = parseSettings(settings);

    // Обновляем поля
    if (body.email !== undefined) {
      const email = sanitizeText(body.email, 254).toLowerCase();
      if (email && !EMAIL_REGEX.test(email)) errors.push('Неверный email');
      else current.email = email;
    }

    if (body.phone !== undefined) {
      const phone = sanitizeText(body.phone, 50);
      if (phone && !PHONE_REGEX.test(phone)) errors.push('Неверный телефон');
      else current.phone = phone;
    }

    if (body.address !== undefined) {
      current.address = sanitizeText(body.address, 300);
    }

    if (body.workingHours !== undefined) {
      current.workingHours = sanitizeText(body.workingHours, 200);
    }

    if (body.aboutText !== undefined) {
      current.aboutText = sanitizeText(body.aboutText, 2000);
    }

    if (body.socials !== undefined) {
      if (!Array.isArray(body.socials)) {
        errors.push('socials должен быть массивом');
      } else if (body.socials.length > 20) {
        errors.push('Слишком много соцсетей (максимум 20)');
      } else {
        const cleaned = [];
        for (const s of body.socials) {
          if (!s || typeof s !== 'object') continue;
          const platform = sanitizeText(s.platform, 50).toLowerCase();
          const url = validateUrl(s.url);
          const label = sanitizeText(s.label, 100);
          if (!platform || !ALLOWED_PLATFORMS.includes(platform)) {
            errors.push(`Неизвестная платформа: ${platform || '?'}`);
            continue;
          }
          if (!url) {
            errors.push(`Неверный URL для ${platform}`);
            continue;
          }
          cleaned.push({ platform, url, label });
        }
        current.socials = cleaned;
      }
    }

    if (errors.length) {
      return res.status(400).json({ message: errors.join('; ') });
    }

    // Сохраняем ТОЛЬКО whitelist-поля.
    // Нельзя передавать всю строку current из БД: после parseRow (PG) она могла бы
    // содержать дублирующие ключи и stale-поля → "multiple assignments to same column".
    const socialsJson = JSON.stringify(Array.isArray(current.socials) ? current.socials : []);
    const update = {
      email: current.email,
      phone: current.phone,
      address: current.address,
      workingHours: current.workingHours,
      socials: socialsJson,
      aboutText: current.aboutText,
      updatedAt: new Date().toISOString()
    };

    await db.updateOne('settings', { _id: 'main' }, update);

    res.json({
      message: 'Настройки сохранены',
      settings: {
        email: update.email,
        phone: update.phone,
        address: update.address,
        workingHours: update.workingHours,
        socials: JSON.parse(socialsJson),
        aboutText: update.aboutText
      }
    });
  } catch (error) {
    console.error('Ошибка обновления настроек:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.ALLOWED_PLATFORMS = ALLOWED_PLATFORMS;