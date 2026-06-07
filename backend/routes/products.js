const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/auth');
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

// Только админ
router.post('/', csrfCheck, authMiddleware, productController.createProduct);
router.put('/:id', validateId, csrfCheck, authMiddleware, productController.updateProduct);
router.delete('/:id', validateId, csrfCheck, authMiddleware, productController.deleteProduct);

module.exports = router;
