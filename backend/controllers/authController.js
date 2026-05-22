const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Регистрация админа (только для первоначальной настройки)
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Укажите username и password' });
    }

    // Проверка существования админа
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Админ с таким username уже существует' });
    }

    // Хеширование пароля с настраиваемыми раундами
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Создание админа
    const admin = new Admin({
      username,
      password: hashedPassword
    });

    await admin.save();

    res.status(201).json({ message: 'Админ успешно создан' });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Вход админа
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Укажите username и password' });
    }

    // Поиск админа
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    // Генерация JWT токена с настраиваемым временем жизни
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { adminId: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: jwtExpiresIn }
    );

    res.json({
      message: 'Вход выполнен успешно',
      token,
      admin: {
        id: admin._id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Проверка токена
exports.verify = async (req, res) => {
  try {
    const admin = await Admin.findById(req.adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Админ не найден' });
    }
    res.json({ admin });
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
