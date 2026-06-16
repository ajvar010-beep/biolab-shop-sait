const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const requireLevel = require('../middleware/requireLevel');
const { csrfCheck } = require('../middleware/security');

// Валидация ID — защита от path traversal и SQL injection
function validateId(req, res, next) {
  const id = req.params.id;
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return res.status(400).json({ message: 'Неверный ID' });
  }
  next();
}

router.get('/', categoryController.getAllCategories);
// Разделы каталога — менеджер (ур.2+).
router.post('/', csrfCheck, authMiddleware, requireLevel(2), categoryController.createCategory);
router.delete('/:id', validateId, csrfCheck, authMiddleware, requireLevel(2), categoryController.deleteCategory);

module.exports = router;
