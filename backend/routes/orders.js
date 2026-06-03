const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { csrfCheck, orderLimiter, orderLookupLimiter } = require('../middleware/security');

// Публичные маршруты
router.post('/', orderLimiter, orderController.createOrder);
router.get('/code/:orderCode', orderLookupLimiter, orderController.getOrderByCode);
router.get('/phone/:phone', orderLookupLimiter, orderController.getOrdersByPhone);

// Защищённые (только админ)
router.get('/', authMiddleware, orderController.getAllOrders);
router.get('/admin/code/:orderCode', authMiddleware, orderController.getOrderByCodeAdmin);
router.post('/:orderCode/complete', csrfCheck, authMiddleware, orderController.completeOrder);
router.post('/:orderCode/cancel', csrfCheck, authMiddleware, orderController.cancelOrder);

module.exports = router;
