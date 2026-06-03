const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { csrfTokenIssue, csrfCheck } = require('../middleware/security');

const requireRegistrationPermission = (req, res, next) => {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return res.status(403).json({ message: 'Регистрация админов отклющена' });
  }
  next();
};

// Публичные: получить CSRF-токен, логин
router.get('/csrf-token', csrfTokenIssue);
router.post('/login', csrfCheck, authController.login);

// Защищённые
router.post('/register', csrfCheck, requireRegistrationPermission, authController.register);
router.get('/verify', authMiddleware, authController.verify);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
