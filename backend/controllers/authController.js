/**
 * Auth Controller — поддерживает SQLite и PostgreSQL
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function isString(v) {
  return typeof v === 'string';
}

function validatePassword(password) {
  if (!isString(password)) return 'Пароль обязателен';
  if (password.length < 8) return 'Пароль: минимум 8 символов';
  return null;
}

function validateUsername(username) {
  if (!isString(username)) return 'Логин обязателен';
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return 'Логин: от 3 до 32 символов';
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return 'Логин: только латиница, цифры, _ и -';
  return null;
}

// Регистрация админа
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ message: userErr });
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ message: passErr });

    const trimmedUsername = username.trim();

    const existingAdmin = await db.findOne('users', { username: trimmedUsername });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Не удалось создать админа' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = 'admin_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    await db.insert('users', {
      _id: id,
      username: trimmedUsername,
      password: hashedPassword,
      role: 'admin',
      tokenVersion: 0
    });

    res.status(201).json({ message: 'Админ успешно создан' });
  } catch (error) {
    console.error('Ошибка регистрации:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Вход админа
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!isString(username) || !isString(password)) {
      return res.status(400).json({ message: 'Укажите username и password' });
    }

    const admin = await db.findOne('users', { username: username.trim() });

    // Dummy hash для безопасности (чтобы не давать информацию о наличии пользователя)
    const dummyHash = '$2b$12$abcdefghijklmnopqrstuv1234567890ABCDEFGHIJKLMNOPQRSTUV';
    const hash = admin ? admin.password : dummyHash;
    const isValid = await bcrypt.compare(password, hash);

    if (!admin || !isValid) {
      return res.status(401).json({ message: 'Неверные учётные данные' });
    }

    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username,
        tv: admin.tokenVersion || 0
      },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Вход выполнен успешно',
      token,
      expiresIn: JWT_EXPIRES_IN,
      admin: { id: admin._id, username: admin.username, level: Number(admin.level) || 1 }
    });
  } catch (error) {
    console.error('Ошибка входа:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Проверка токена
exports.verify = async (req, res) => {
  try {
    res.json({ admin: { id: req.adminId, username: req.admin.username, level: Number(req.admin.level) || 1 } });
  } catch (error) {
    console.error('Ошибка проверки токена:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Logout - инкрементируем tokenVersion
exports.logout = async (req, res) => {
  try {
    const admin = await db.findOne('users', { _id: req.adminId });
    if (admin) {
      await db.updateOne('users', { _id: req.adminId }, { tokenVersion: (admin.tokenVersion || 0) + 1 });
    }
    res.json({ message: 'Выход выполнен' });
  } catch (error) {
    console.error('Ошибка logout:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Создание админа по умолчанию (для инициализации)
exports.createDefaultAdmin = async (username, password) => {
  try {
    const existing = await db.findOne('users', { username });
    if (existing) return false;

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.insert('users', {
      _id: 'admin_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      username,
      password: hashedPassword,
      role: 'admin',
      level: 3,
      tokenVersion: 0
    });
    return true;
  } catch (error) {
    console.error('Ошибка создания админа:', error.message);
    return false;
  }
};

// Переиспользуется в adminController (создание/смена пароля управляемых аккаунтов)
exports.validateUsername = validateUsername;
exports.validatePassword = validatePassword;
exports.BCRYPT_ROUNDS = BCRYPT_ROUNDS;