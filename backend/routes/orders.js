const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/auth');
const { csrfCheck, orderLimiter, orderLookupLimiter } = require('../middleware/security');
const { hcaptchaMiddleware } = require('../middleware/hcaptcha');

// Публичные маршруты
router.post('/', orderLimiter, hcaptchaMiddleware, orderController.createOrder);
router.get('/code/:orderCode', orderLookupLimiter, orderController.getOrderByCode);
// Поиск заказов по телефону — только для админа (PII: иначе любой перебирал бы чужие заказы)
router.get('/phone/:phone', authMiddleware, orderController.getOrdersByPhone);

// Защищённые (только админ)
router.get('/', authMiddleware, orderController.getAllOrders);
router.get('/admin/code/:orderCode', authMiddleware, orderController.getOrderByCodeAdmin);
router.post('/:orderCode/complete', csrfCheck, authMiddleware, orderController.completeOrder);
router.post('/:orderCode/cancel', csrfCheck, authMiddleware, orderController.cancelOrder);

module.exports = router;
