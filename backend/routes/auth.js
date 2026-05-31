const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const requireRegistrationPermission = (req, res, next) => {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return res.status(403).json({ message: 'Регистрация админов отключена' });
  }
  next();
};

router.post('/register', requireRegistrationPermission, authController.register);
router.post('/login', authController.login);
router.get('/verify', authMiddleware, authController.verify);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
