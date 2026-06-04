/**
 * Product Controller - SQLite версия
 */
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const storage = require('../services/storage');

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp)$/i;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Multer хранит файл в памяти (потом передаём в storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname || file.originalname.length > 255) {
      return cb(new Error('Неверное имя файла'));
    }
    if (/[<>:"/\\|?*\x00-\x1f]/.test(file.originalname)) {
      return cb(new Error('Недопустимые символы в имени файла'));
    }
    if (!ALLOWED_EXT.test(file.originalname)) {
      return cb(new Error('Разрешены только изображения JPG/PNG/GIF/WebP'));
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error('Неверный тип файла'));
    }
    cb(null, true);
  }
}).single('image');

function uploadAsync(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => err ? reject(err) : resolve());
  });
}

// Удалить временно загруженный файл из памяти (больше не нужно - используем memoryStorage)
async function deleteUploadedFile(file) {
  // memoryStorage не создаёт файл, ничего не делаем
}

// Удалить старый файл через storage сервис
async function deleteOldImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl) return;
  // Пропускаем внешние URL (уже в S3 или CDN)
  if (imageUrl.startsWith('http')) return;
  try {
    await storage.deleteFile(imageUrl);
  } catch (_) {
    // ignore
  }
}

function validateUrl(url, fieldName) {
  if (!url) return { ok: true, value: '' };
  if (typeof url !== 'string') return { ok: false, message: `${fieldName} должен быть строкой` };
  const trimmed = url.trim();
  if (!trimmed) return { ok: true, value: '' };
  if (trimmed.length > 500) return { ok: false, message: `${fieldName} слишком длинный` };
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, message: `${fieldName} должен начинаться с http:// или https://` };
  }
  return { ok: true, value: trimmed };
}

function validateProductPayload(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim()) errors.push('Название обязательно');
    else if (body.title.length > 200) errors.push('Название слишком длинное (≤ 200)');
    else out.title = body.title.trim();
  }
  if (body.description !== undefined || !partial) {
    if (typeof body.description !== 'string' || !body.description.trim()) errors.push('Описание обязательно');
    else if (body.description.length > 2000) errors.push('Описание слишком длинное (≤ 2000)');
    else out.description = body.description.trim();
  }
  if (body.price !== undefined || !partial) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0 || n > 1000000) errors.push('Цена: 0 - 1 000 000');
    else out.price = n;
  }
  if (body.salePrice !== undefined && body.salePrice !== null && body.salePrice !== '') {
    const n = Number(body.salePrice);
    if (!Number.isFinite(n) || n < 0 || n > 1000000) errors.push('Акционная цена: 0 - 1 000 000');
    else out.salePrice = n;
  } else {
    out.salePrice = null;
  }
  if (body.saleStart !== undefined && body.saleStart !== '') {
    const d = new Date(body.saleStart);
    if (isNaN(d.getTime())) errors.push('Неверная дата начала акции');
    else out.saleStart = d.toISOString();
  } else {
    out.saleStart = null;
  }
  if (body.saleEnd !== undefined && body.saleEnd !== '') {
    const d = new Date(body.saleEnd);
    if (isNaN(d.getTime())) errors.push('Неверная дата окончания акции');
    else out.saleEnd = d.toISOString();
  } else {
    out.saleEnd = null;
  }
  if (body.category !== undefined || !partial) {
    if (typeof body.category !== 'string' || !body.category.trim()) errors.push('Категория обязательна');
    else if (body.category.length > 100) errors.push('Категория: ≤ 100 символов');
    else out.category = body.category.trim();
  }
  if (body.stock !== undefined) {
    const n = Number(body.stock);
    if (!Number.isFinite(n) || n < 0 || n > 100000) errors.push('Остаток: 0 - 100 000');
    else out.stock = Math.floor(n);
  } else if (!partial) {
    out.stock = 0;
  }
  if (body.size !== undefined) {
    if (!['normal', 'wide', 'large'].includes(body.size)) errors.push('Неверный размер');
    else out.size = body.size;
  } else if (!partial) {
    out.size = 'normal';
  }
  if (body.modelUrl !== undefined) {
    const r = validateUrl(body.modelUrl, 'URL модели');
    if (!r.ok) errors.push(r.message);
    else out.modelUrl = r.value;
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) errors.push('images должен быть массивом');
    else {
      const validImages = [];
      for (const img of body.images) {
        if (typeof img !== 'string') continue;
        const trimmed = img.trim();
        if (!trimmed) continue;
        if (trimmed.length > 500) { errors.push('URL изображения слишком длинный'); continue; }
        validImages.push(trimmed);
      }
      out.images = JSON.stringify(validImages);
    }
  }

  return { errors, data: out };
}

// Получить все товары
exports.getAllProducts = async (req, res) => {
  try {
    const { category, sort } = req.query;
    const query = {};
    if (typeof category === 'string' && category.trim()) {
      query.category = category.trim();
    }

    let products = await db.find('products', query);

    // Сортировка
    if (sort === 'price_asc') {
      products.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (sort === 'price_desc') {
      products.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else {
      products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Парсим images
    products = products.map(p => {
      if (p.images && typeof p.images === 'string') {
        try { p.images = JSON.parse(p.images); } catch (_) { p.images = []; }
      }
      return p;
    });

    // Пагинация
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const total = products.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    res.json({
      products: products.slice(skip, skip + limit),
      total,
      page,
      limit,
      totalPages
    });
  } catch (error) {
    console.error('Ошибка получения товаров:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await db.findOne('products', { _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Товар не найден' });

    // Парсим images
    if (product.images && typeof product.images === 'string') {
      try { product.images = JSON.parse(product.images); } catch (_) { product.images = []; }
    }

    res.json(product);
  } catch (error) {
    console.error('Ошибка получения товара:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    await uploadAsync(req, res);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
  }

  try {
    const { errors, data } = validateProductPayload(req.body, { partial: false });
    if (errors.length) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({ message: errors.join('; ') });
    }

    // Проверяем существование категории
    const categoryExists = await db.findOne('categories', { name: data.category });
    if (!categoryExists) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({ message: 'Категория не найдена' });
    }

    if (req.file) {
      const result = await storage.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      data.imageUrl = result.url;
    } else {
      data.imageUrl = '';
    }

    data._id = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    data.createdAt = new Date().toISOString();
    data.updatedAt = data.createdAt;

    await db.insert('products', data);

    // Парсим images для ответа
    if (data.images && typeof data.images === 'string') {
      try { data.images = JSON.parse(data.images); } catch (_) {}
    }

    res.status(201).json(data);
  } catch (error) {
    await deleteUploadedFile(req.file);
    console.error('Ошибка создания товара:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    await uploadAsync(req, res);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
  }

  try {
    const product = await db.findOne('products', { _id: req.params.id });
    if (!product) {
      await deleteUploadedFile(req.file);
      return res.status(404).json({ message: 'Товар не найден' });
    }

    const { errors, data } = validateProductPayload(req.body, { partial: true });
    if (errors.length) {
      await deleteUploadedFile(req.file);
      return res.status(400).json({ message: errors.join('; ') });
    }

    if (data.category) {
      const categoryExists = await db.findOne('categories', { name: data.category });
      if (!categoryExists) {
        await deleteUploadedFile(req.file);
        return res.status(400).json({ message: 'Категория не найдена' });
      }
    }

    const oldImageUrl = product.imageUrl;
    if (req.file) {
      const result = await storage.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      data.imageUrl = result.url;
    }

    data.updatedAt = new Date().toISOString();

    await db.updateOne('products', { _id: req.params.id }, data);

    // Удаляем старое изображение, если его заменили
    if (req.file && oldImageUrl && oldImageUrl !== data.imageUrl) {
      await deleteOldImage(oldImageUrl);
    }

    // Получаем обновлённый товар
    const updated = await db.findOne('products', { _id: req.params.id });
    if (updated.images && typeof updated.images === 'string') {
      try { updated.images = JSON.parse(updated.images); } catch (_) { updated.images = []; }
    }

    res.json(updated);
  } catch (error) {
    await deleteUploadedFile(req.file);
    console.error('Ошибка обновления товара:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await db.findOne('products', { _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Товар не найден' });

    await db.deleteOne('products', { _id: req.params.id });

    // Удаляем картинку с диска
    if (product.imageUrl) await deleteOldImage(product.imageUrl);

    res.json({ message: 'Товар удалён' });
  } catch (error) {
    console.error('Ошибка удаления товара:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};