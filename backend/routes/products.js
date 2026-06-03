const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/auth');
const { csrfCheck } = require('../middleware/security');

// Публичные
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Только админ
router.post('/', csrfCheck, authMiddleware, productController.createProduct);
router.put('/:id', csrfCheck, authMiddleware, productController.updateProduct);
router.delete('/:id', csrfCheck, authMiddleware, productController.deleteProduct);

module.exports = router;
