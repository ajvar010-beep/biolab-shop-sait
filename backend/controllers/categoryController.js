/**
 * Category Controller - SQLite версия
 */
const db = require('../config/database');

function isString(v) { return typeof v === 'string'; }

function transliterate(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
    'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
    'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
    'э':'e','ю':'yu','я':'ya'
  };
  return str.split('').map(ch => map[ch] !== undefined ? map[ch] : ch).join('');
}

function makeSlug(name) {
  const slug = transliterate(String(name).toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug || slug.length === 0) return null;
  return slug.slice(0, 100);
}

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await db.find('categories');
    categories.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    res.json(categories);
  } catch (error) {
    console.error('Ошибка получения категорий:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body || {};

    if (!isString(name) || !name.trim()) {
      return res.status(400).json({ message: 'Укажите название' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({ message: 'Название слишком длинное' });
    }

    let finalSlug;
    if (isString(slug) && slug.trim()) {
      finalSlug = slug.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(finalSlug) || finalSlug.length > 100) {
        return res.status(400).json({ message: 'Неверный формат slug (a-z, 0-9, дефис)' });
      }
    } else {
      finalSlug = makeSlug(trimmedName);
      if (!finalSlug) {
        return res.status(400).json({ message: 'Не удалось сгенерировать slug' });
      }
    }

    // Проверяем дубликаты
    const existing = await db.findOne('categories', { name: trimmedName });
    if (existing) {
      return res.status(400).json({ message: 'Категория с таким названием уже существует' });
    }

    const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    const category = {
      _id: id,
      name: trimmedName,
      slug: finalSlug,
      createdAt: now
    };

    await db.insert('categories', category);
    res.status(201).json(category);
  } catch (error) {
    console.error('Ошибка создания категории:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await db.findOne('categories', { _id: req.params.id });
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }

    // Проверяем, что нет товаров в этой категории
    const products = await db.find('products', { category: category.name });
    if (products.length > 0) {
      return res.status(400).json({
        message: `В категории есть товары (${products.length}). Сначала переместите их в другую категорию.`
      });
    }

    await db.deleteOne('categories', { _id: req.params.id });
    res.json({ message: 'Категория удалена' });
  } catch (error) {
    console.error('Ошибка удаления категории:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};