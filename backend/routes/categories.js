const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');

router.get('/', categoryController.getAllCategories);
router.post('/', authMiddleware, categoryController.createCategory);
router.delete('/:id', authMiddleware, categoryController.deleteCategory);

module.exports = router;
