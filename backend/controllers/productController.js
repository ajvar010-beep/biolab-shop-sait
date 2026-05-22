const Product = require('../models/Product');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

// Функция валидации ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1 // только один файл
  },
  fileFilter: (req, file, cb) => {
    // Проверка расширения файла
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp)$/i;
    const extname = allowedExtensions.test(file.originalname);

    // Проверка MIME типа
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    // Проверка размера имени файла
    if (file.originalname.length > 255) {
      return cb(new Error('Имя файла слишком длинное'));
    }

    // Проверка на опасные символы в имени файла
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
      return cb(new Error('Недопустимые символы в имени файла'));
    }

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
    }
  }
}).single('image');

// Получить все товары
exports.getAllProducts = async (req, res) => {
  try {
    const { category, sort } = req.query;
    let query = {};

    if (category) {
      query.category = category;
    }

    let products = Product.find(query);

    // Сортировка
    if (sort === 'price_asc') {
      products = products.sort({ price: 1 });
    } else if (sort === 'price_desc') {
      products = products.sort({ price: -1 });
    } else if (sort === 'date_desc') {
      products = products.sort({ createdAt: -1 });
    }

    const result = await products;
    res.json(result);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить товар по ID
exports.getProductById = async (req, res) => {
  try {
    // Валидация ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Неверный формат ID товара' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json(product);
  } catch (error) {
    console.error('Ошибка получения товара:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Создать товар (только для админа)
exports.createProduct = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      const { title, description, price, category, stock, size, modelUrl } = req.body;

      // Валидация обязательных полей
      if (!title || !description || !price || !category) {
        return res.status(400).json({ message: 'Заполните все обязательные поля' });
      }

      // Валидация длины строк
      if (title.length > 200) {
        return res.status(400).json({ message: 'Название товара слишком длинное (макс. 200 символов)' });
      }

      if (description.length > 2000) {
        return res.status(400).json({ message: 'Описание товара слишком длинное (макс. 2000 символов)' });
      }

      // Валидация цены
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0 || numPrice > 1000000) {
        return res.status(400).json({ message: 'Неверная цена (должна быть от 0 до 1,000,000)' });
      }

      // Валидация остатка
      const numStock = Number(stock) || 0;
      if (isNaN(numStock) || numStock < 0 || numStock > 10000) {
        return res.status(400).json({ message: 'Неверный остаток (должен быть от 0 до 10,000)' });
      }

      // Валидация размера
      const allowedSizes = ['normal', 'wide', 'large'];
      const productSize = size || 'normal';
      if (!allowedSizes.includes(productSize)) {
        return res.status(400).json({ message: 'Неверный размер товара' });
      }

      // Валидация URL модели (если указан)
      if (modelUrl && modelUrl.length > 500) {
        return res.status(400).json({ message: 'URL модели слишком длинный (макс. 500 символов)' });
      }

      const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

      const product = new Product({
        title: title.trim(),
        description: description.trim(),
        price: numPrice,
        category: category.trim(),
        imageUrl,
        modelUrl: modelUrl ? modelUrl.trim() : '',
        stock: numStock,
        size: productSize
      });

      await product.save();
      res.status(201).json(product);
    } catch (error) {
      console.error('Ошибка создания товара:', error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });
};

// Обновить товар (только для админа)
exports.updateProduct = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }

    try {
      // Валидация ObjectId
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: 'Неверный формат ID товара' });
      }

      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Товар не найден' });
      }

      const { title, description, price, category, stock, size, modelUrl } = req.body;

      if (title) product.title = title;
      if (description) product.description = description;
      if (price) product.price = Number(price);
      if (category) product.category = category;
      if (stock !== undefined) product.stock = Number(stock);
      if (size) product.size = size;
      if (modelUrl !== undefined) product.modelUrl = modelUrl;
      if (req.file) product.imageUrl = `/uploads/${req.file.filename}`;

      await product.save();
      res.json(product);
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  });
};

// Удалить товар (только для админа)
exports.deleteProduct = async (req, res) => {
  try {
    // Валидация ObjectId
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Неверный формат ID товара' });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json({ message: 'Товар удален' });
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
