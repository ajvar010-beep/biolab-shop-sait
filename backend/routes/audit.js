const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const requireLevel = require('../middleware/requireLevel');
const audit = require('../services/audit');

// GET /api/audit — журнал действий нижних уровней. Ур.2 видит действия ур.1; ур.3 — ур.1 и 2.
router.get('/', authMiddleware, requireLevel(2), async (req, res) => {
  try {
    const entries = await audit.list({
      viewerLevel: Number(req.admin.level) || 1,
      limit: req.query.limit,
      offset: req.query.offset
    });
    res.json({ entries });
  } catch (error) {
    console.error('Ошибка получения журнала:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
