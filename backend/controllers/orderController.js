const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendOrderEmail } = require('../utils/emailSender');

// Функция валидации ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Создать заказ
exports.createOrder = async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, items } = req.body;

    if (!customerName || !customerPhone || !customerEmail || !items || items.length === 0) {
      return res.status(400).json({ message: 'Заполните все поля и добавьте товары' });
    }

    // Валидация имени
    if (customerName.length < 2 || customerName.length > 100) {
      return res.status(400).json({ message: 'Имя должно содержать от 2 до 100 символов' });
    }

    // Валидация телефона (российский формат)
    const phoneRegex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s/g, ''))) {
      return res.status(400).json({ message: 'Неверный формат телефона' });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail) || customerEmail.length > 254) {
      return res.status(400).json({ message: 'Неверный формат email' });
    }

    // Валидация количества товаров в заказе
    if (items.length > 50) {
      return res.status(400).json({ message: 'Слишком много товаров в заказе (максимум 50)' });
    }

    // Проверка наличия товаров и расчет суммы
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      // Валидация ObjectId товара
      if (!isValidObjectId(item.productId)) {
        return res.status(400).json({ message: `Неверный формат ID товара: ${item.productId}` });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Товар с ID ${item.productId} не найден` });
      }

      // Валидация количества товара
      if (!item.quantity || item.quantity < 1 || item.quantity > 100) {
        return res.status(400).json({ message: `Неверное количество товара (должно быть от 1 до 100)` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Недостаточно товара "${product.title}". В наличии: ${product.stock}`
        });
      }

      orderItems.push({
        productId: product._id,
        title: product.title,
        price: product.price,
        quantity: item.quantity
      });

      totalAmount += product.price * item.quantity;

      // Уменьшаем остаток товара
      product.stock -= item.quantity;
      await product.save();
    }

    // Генерация уникального номера заказа
    const orderNumber = 'BL' + Date.now() + Math.floor(Math.random() * 1000);

    // Генерация QR-кода
    const qrCode = await generateQRCode(orderNumber);

    // Создание заказа
    const order = new Order({
      orderNumber,
      customerName,
      customerPhone,
      customerEmail,
      items: orderItems,
      totalAmount,
      qrCode
    });

    await order.save();

    // Отправка email с QR-кодом
    try {
      await sendOrderEmail(customerEmail, orderNumber, qrCode, {
        customerName,
        customerPhone,
        items: orderItems,
        totalAmount
      });
    } catch (emailError) {
      console.error('Ошибка отправки email:', emailError);
      // Заказ уже создан, продолжаем
    }

    res.status(201).json({
      message: 'Заказ успешно создан',
      order: {
        orderNumber,
        qrCode,
        totalAmount,
        items: orderItems
      }
    });
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить все заказы (только для админа)
exports.getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.productId', 'title')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить заказ по номеру
exports.getOrderByNumber = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.productId', 'title imageUrl');

    if (!order) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }

    res.json(order);
  } catch (error) {
    console.error('Ошибка получения заказа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Обновить статус заказа (только для админа)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Недопустимый статус' });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }

    order.status = status;
    if (status === 'completed') {
      order.completedAt = new Date();
    }

    await order.save();
    res.json({ message: 'Статус заказа обновлен', order });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Отменить заказ и вернуть товары на склад (только для админа)
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) {
      return res.status(404).json({ message: 'Заказ не найден' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ message: 'Нельзя отменить выполненный заказ' });
    }

    // Возвращаем товары на склад
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Заказ отменен, товары возвращены на склад', order });
  } catch (error) {
    console.error('Ошибка отмены заказа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
