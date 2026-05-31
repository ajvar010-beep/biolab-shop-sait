const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// Публично — для футера и блока «о нас» на главной
router.get('/', settingsController.getSettings);

// Только админ
router.put('/', authMiddleware, settingsController.updateSettings);

module.exports = router;
