const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const { csrfCheck } = require('../middleware/security');

router.get('/', categoryController.getAllCategories);
router.post('/', csrfCheck, authMiddleware, categoryController.createCategory);
router.delete('/:id', csrfCheck, authMiddleware, categoryController.deleteCategory);

module.exports = router;
