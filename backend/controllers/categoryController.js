const Category = require('../models/Category');

// Получить все категории
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Создать категорию (только для админа)
exports.createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: 'Укажите название и slug' });
    }

    const existingCategory = await Category.findOne({ $or: [{ name }, { slug }] });
    if (existingCategory) {
      return res.status(400).json({ message: 'Категория с таким названием или slug уже существует' });
    }

    const category = new Category({ name, slug });
    await category.save();

    res.status(201).json(category);
  } catch (error) {
    console.error('Ошибка создания категории:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Удалить категорию (только для админа)
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    res.json({ message: 'Категория удалена' });
  } catch (error) {
    console.error('Ошибка удаления категории:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
