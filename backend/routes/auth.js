const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Middleware для проверки разрешения регистрации
const requireRegistrationPermission = (req, res, next) => {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return res.status(403).json({ message: 'Регистрация админов отключена' });
  }
  next();
};

// Регистрация админа (только при ALLOW_REGISTRATION=true)
router.post('/register', requireRegistrationPermission, authController.register);

// Вход админа
router.post('/login', authController.login);

// Проверка токена
router.get('/verify', authMiddleware, authController.verify);

module.exports = router;
