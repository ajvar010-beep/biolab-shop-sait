const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// Публичный автоперевод поискового запроса (GET /api/search/translate?q=...)
router.get('/translate', searchController.translate);

module.exports = router;
