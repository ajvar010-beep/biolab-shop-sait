const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const { csrfCheck } = require('../middleware/security');

// Публично — для футера и блока «о нас» на главной
router.get('/', settingsController.getSettings);

// Только админ
router.put('/', csrfCheck, authMiddleware, settingsController.updateSettings);

module.exports = router;
