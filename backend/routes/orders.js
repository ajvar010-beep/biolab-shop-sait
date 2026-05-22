const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');

// Публичные маршруты
router.post('/', orderController.createOrder);
router.get('/number/:orderNumber', orderController.getOrderByNumber);

// Защищенные маршруты (только для админа)
router.get('/', authMiddleware, orderController.getAllOrders);
router.put('/:orderNumber/status', authMiddleware, orderController.updateOrderStatus);
router.post('/:orderNumber/cancel', authMiddleware, orderController.cancelOrder);

module.exports = router;
