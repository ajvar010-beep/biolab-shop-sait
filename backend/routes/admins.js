const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const requireLevel = require('../middleware/requireLevel');
const { csrfCheck } = require('../middleware/security');

// Валидация ID — защита от path traversal и SQL injection (как в routes/products.js)
function validateId(req, res, next) {
  const id = req.params.id;
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ message: 'Неверный ID' });
  }
  next();
}

// Все маршруты требуют авторизацию.
router.use(authMiddleware);

// Сменить свой пароль — доступно любому уровню.
router.post('/me/password', csrfCheck, adminController.changeOwnPassword);

// Список управляемых аккаунтов — ур.2+.
router.get('/', requireLevel(2), adminController.listAdmins);

// Создать аккаунт — только ур.3 (владелец).
router.post('/', csrfCheck, requireLevel(3), adminController.createAdmin);

// Управление конкретным аккаунтом.
router.delete('/:id', validateId, csrfCheck, requireLevel(2), adminController.deleteAdmin);
router.put('/:id/password', validateId, csrfCheck, requireLevel(2), adminController.setAdminPassword);
router.post('/:id/logout', validateId, csrfCheck, requireLevel(2), adminController.forceLogout);
router.put('/:id/level', validateId, csrfCheck, requireLevel(3), adminController.setAdminLevel);
router.put('/:id/username', validateId, csrfCheck, requireLevel(3), adminController.renameAdmin);

module.exports = router;
