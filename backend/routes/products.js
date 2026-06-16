const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
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

// Публичные
router.get('/', productController.getAllProducts);
router.get('/:id', validateId, productController.getProductById);

// Выложить товар — обычный админ (ур.1+).
router.post('/', csrfCheck, authMiddleware, requireLevel(1), productController.createProduct);
// Редактировать/удалять уже выставленные товары — менеджер (ур.2+).
router.put('/:id', validateId, csrfCheck, authMiddleware, requireLevel(2), productController.updateProduct);
router.delete('/:id', validateId, csrfCheck, authMiddleware, requireLevel(2), productController.deleteProduct);

module.exports = router;
