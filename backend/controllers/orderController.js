/**
 * Order Controller - SQLite версия
 */
const crypto = require('crypto');
const db = require('../config/database');

function generateOrderCode() {
  const min = 100000000000;
  const max = 1000000000000;
  return String(crypto.randomInt(min, max));
}

const PHONE_REGEX = /^\+?[\d\s().-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeName(name) {
  return String(name || '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Создать заказ
exports.createOrder = async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : null;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }
    if (items.length > 10) {
      return res.status(400).json({ message: 'Слишком много позиций (максимум 10)' });
    }

    const customerName = sanitizeName(body.customerName);
    if (customerName.length < 2 || customerName.length > 100) {
      return res.status(400).json({ message: 'Имя: от 2 до 100 символов' });
    }

    if (typeof body.customerPhone !== 'string') {
      return res.status(400).json({ message: 'Телефон обязателен' });
    }
    const customerPhone = body.customerPhone.trim();
    if (!PHONE_REGEX.test(customerPhone)) {
      return res.status(400).json({ message: 'Неверный формат телефона' });
    }

    let customerEmail = '';
    if (typeof body.customerEmail === 'string' && body.customerEmail.trim()) {
      customerEmail = body.customerEmail.trim().toLowerCase();
      if (!EMAIL_REGEX.test(customerEmail) || customerEmail.length > 254) {
        return res.status(400).json({ message: 'Неверный email' });
      }
    }

    const requested = [];
    for (const it of items) {
      if (!it || !it.productId || typeof it.productId !== 'string') {
        return res.status(400).json({ message: 'Неверный ID товара' });
      }
      const qty = Math.floor(Number(it.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
        return res.status(400).json({ message: 'Неверное количество (1-100)' });
      }
      requested.push({ productId: it.productId, quantity: qty });
    }

    const orderItems = [];
    let totalAmount = 0;
    const reservedItems = [];

    // Обрабатываем каждый товар
    for (const { productId, quantity } of requested) {
      const product = db.findOne('products', { _id: productId });

      if (!product) {
        // Откатываем зарезервированные
        for (const r of reservedItems) {
          const p = db.findOne('products', { _id: r.productId });
          if (p) {
            db.updateOne('products', { _id: r.productId }, { stock: p.stock + r.quantity });
          }
        }
        return res.status(400).json({ message: `Товар не найден: ${productId}` });
      }

      if (product.stock < quantity) {
        // Откатываем зарезервированные
        for (const r of reservedItems) {
          const p = db.findOne('products', { _id: r.productId });
          if (p) {
            db.updateOne('products', { _id: r.productId }, { stock: p.stock + r.quantity });
          }
        }
        return res.status(400).json({
          message: `Недостаточно товара "${product.title}" (в наличии: ${product.stock})`
        });
      }

      // Резервируем товар
      db.updateOne('products', { _id: productId }, { stock: product.stock - quantity });
      reservedItems.push({ productId, quantity });

      orderItems.push({
        productId: product._id,
        title: product.title,
        price: product.price,
        quantity
      });
      totalAmount += product.price * quantity;
    }

    // Генерируем уникальный код заказа
    let orderCode = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateOrderCode();
      const exists = db.findOne('orders', { orderCode: candidate });
      if (!exists) {
        orderCode = candidate;
        break;
      }
    }
    if (!orderCode) {
      return res.status(500).json({ message: 'Не удалось сгенерировать код заказа' });
    }

    const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    const orderData = {
      _id: orderId,
      orderCode,
      customerName,
      customerPhone,
      customerEmail,
      items: JSON.stringify(orderItems),
      totalAmount,
      totalPrice: totalAmount,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    db.insert('orders', orderData);

    res.status(201).json({
      message: 'Заказ успешно создан',
      order: {
        orderCode,
        totalAmount,
        totalPrice: totalAmount,
        items: orderItems
      }
    });
  } catch (error) {
    console.error('Ошибка создания заказа:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Все заказы (админ)
exports.getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (typeof status === 'string' && ['pending', 'completed', 'cancelled'].includes(status)) {
      query.status = status;
    }

    let orders = db.find('orders', query);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

    // Парсим items
    orders = orders.slice(skip, skip + limit).map(o => {
      if (o.items && typeof o.items === 'string') {
        try { o.items = JSON.parse(o.items); } catch (_) { o.items = []; }
      }
      return o;
    });

    const total = db.countDocuments('orders', query);
    res.json({ orders, total, limit, skip });
  } catch (error) {
    console.error('Ошибка получения заказов:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Найти заказ по коду (публичный)
exports.getOrderByCode = async (req, res) => {
  try {
    const code = String(req.params.orderCode || '');
    if (!/^\d{9,12}$/.test(code)) {
      return res.status(400).json({ message: 'Неверный формат кода' });
    }

    const order = db.findOne('orders', { orderCode: code });
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });

    const items = order.items && typeof order.items === 'string'
      ? JSON.parse(order.items)
      : (order.items || []);

    res.json({
      orderCode: order.orderCode,
      status: order.status,
      items,
      totalAmount: order.totalAmount || order.totalPrice,
      createdAt: order.createdAt,
      completedAt: order.completedAt
    });
  } catch (error) {
    console.error('Ошибка получения заказа:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Найти заказы по телефону
exports.getOrdersByPhone = async (req, res) => {
  try {
    const phone = String(req.params.phone || '').trim();
    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Неверный формат телефона' });
    }

    let orders = db.find('orders', { customerPhone: phone });
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    orders = orders.slice(0, 50);

    const publicOrders = orders.map(order => {
      const items = order.items && typeof order.items === 'string'
        ? JSON.parse(order.items)
        : (order.items || []);

      return {
        orderCode: order.orderCode,
        status: order.status,
        items,
        totalAmount: order.totalAmount || order.totalPrice,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        cancelledAt: order.cancelledAt
      };
    });

    res.json({ orders: publicOrders, count: publicOrders.length });
  } catch (error) {
    console.error('Ошибка поиска заказов:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Полная информация о заказе (админ)
exports.getOrderByCodeAdmin = async (req, res) => {
  try {
    const code = String(req.params.orderCode || '');
    if (!/^\d{9,12}$/.test(code)) {
      return res.status(400).json({ message: 'Неверный формат кода' });
    }

    const order = db.findOne('orders', { orderCode: code });
    if (!order) return res.status(404).json({ message: 'Заказ не найден' });

    if (order.items && typeof order.items === 'string') {
      try { order.items = JSON.parse(order.items); } catch (_) { order.items = []; }
    }

    res.json(order);
  } catch (error) {
    console.error('Ошибка получения заказа (админ):', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отметить заказ выданным
exports.completeOrder = async (req, res) => {
  try {
    const code = String(req.params.orderCode || '');
    if (!/^\d{9,12}$/.test(code)) {
      return res.status(400).json({ message: 'Неверный формат кода' });
    }

    const order = db.findOne('orders', { orderCode: code, status: 'pending' });
    if (!order) {
      return res.status(400).json({ message: 'Заказ нельзя выдать (уже выдан, отменён или не найден)' });
    }

    const now = new Date().toISOString();
    db.updateOne('orders', { _id: order._id }, {
      status: 'completed',
      completedAt: now,
      updatedAt: now
    });

    const updated = db.findOne('orders', { _id: order._id });
    if (updated.items && typeof updated.items === 'string') {
      try { updated.items = JSON.parse(updated.items); } catch (_) { updated.items = []; }
    }

    res.json({ message: 'Заказ выдан', order: updated });
  } catch (error) {
    console.error('Ошибка выдачи заказа:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отменить заказ
exports.cancelOrder = async (req, res) => {
  try {
    const code = String(req.params.orderCode || '');
    if (!/^\d{9,12}$/.test(code)) {
      return res.status(400).json({ message: 'Неверный формат кода' });
    }

    const reason = typeof req.body?.reason === 'string'
      ? req.body.reason.slice(0, 500)
      : '';

    const order = db.findOne('orders', { orderCode: code, status: 'pending' });
    if (!order) {
      return res.status(400).json({ message: 'Заказ нельзя отменить (уже выдан, отменён или не найден)' });
    }

    // Возвращаем товары на склад
    const items = order.items && typeof order.items === 'string'
      ? JSON.parse(order.items)
      : (order.items || []);

    for (const item of items) {
      const product = db.findOne('products', { _id: item.productId });
      if (product) {
        db.updateOne('products', { _id: item.productId }, {
          stock: product.stock + item.quantity
        });
      }
    }

    const now = new Date().toISOString();
    db.updateOne('orders', { _id: order._id }, {
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: reason,
      updatedAt: now
    });

    const updated = db.findOne('orders', { _id: order._id });
    if (updated.items && typeof updated.items === 'string') {
      try { updated.items = JSON.parse(updated.items); } catch (_) { updated.items = []; }
    }

    res.json({ message: 'Заказ отменён, товары возвращены', order: updated });
  } catch (error) {
    console.error('Ошибка отмены заказа:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};