const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const requireLevel = require('../middleware/requireLevel');
const { csrfCheck } = require('../middleware/security');

// Публично — для футера и блока «о нас» на главной
router.get('/', settingsController.getSettings);

// Настройки магазина (адрес, часы, соцсети, «о нас») — менеджер (ур.2+).
router.put('/', csrfCheck, authMiddleware, requireLevel(2), settingsController.updateSettings);

module.exports = router;
