/**
 * Orders Tests - тестирование создания заказов
 */
const request = require('supertest');
const app = require('../backend/server');
const db = require('../backend/config/database');

describe('Orders Endpoints', () => {

  describe('POST /api/orders - валидация', () => {

    it('должен вернуть 400 без items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          customerName: 'Test User',
          customerPhone: '+79001234567'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Корзина');
    });

    it('должен вернуть 400 с пустым items', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [],
          customerName: 'Test User',
          customerPhone: '+79001234567'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Корзина');
    });

    it('должен вернуть 400 без customerName', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: 'test', quantity: 1 }],
          customerPhone: '+79001234567'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Имя');
    });

    it('должен вернуть 400 без phone', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: 'test', quantity: 1 }],
          customerName: 'Test User'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Телефон');
    });

    it('должен вернуть 400 с невалидным номером телефона', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: 'test', quantity: 1 }],
          customerName: 'Test User',
          customerPhone: '123' // слишком короткий
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('телефон');
    });

    it('должен вернуть 400 с несуществующим товаром', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: 'nonexistent_product', quantity: 1 }],
          customerName: 'Test User',
          customerPhone: '+79001234567'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Товар не найден');
    });

  });

  describe('POST /api/orders - успешное создание', () => {

    it('должен создать заказ с валидными данными', async () => {
      // Сначала создаём тестовый товар с категорией
      const productId = 'test_product_001';
      db.insert('products', {
        _id: productId,
        title: 'Тестовый товар',
        description: 'Описание',
        price: 500,
        category: 'Тестовые товары',
        stock: 10
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: productId, quantity: 2 }],
          customerName: 'Тестовый Пользователь',
          customerPhone: '+79001234567',
          customerEmail: 'test@example.com'
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('order');
      expect(response.body.order).toHaveProperty('orderCode');
      expect(response.body.order).toHaveProperty('totalAmount', 1000); // 500 * 2
      expect(response.body.order.items).toHaveLength(1);
      expect(response.body.order.items[0].title).toBe('Тестовый товар');

      // Проверяем что товар в базе обновился
      const updatedProduct = db.findOne('products', { _id: productId });
      expect(updatedProduct.stock).toBe(8); // было 10, уменьшилось на 2
    });

    it('должен вернуть 400 если недостаточно товара на складе', async () => {
      // Создаём товар с ограниченным количеством
      const productId = 'test_product_002';
      db.insert('products', {
        _id: productId,
        title: 'Ограниченный товар',
        description: 'Описание',
        price: 300,
        category: 'Тестовые товары',
        stock: 2
      });

      const response = await request(app)
        .post('/api/orders')
        .set('Content-Type', 'application/json')
        .send({
          items: [{ productId: productId, quantity: 5 }], // запрашиваем 5, есть 2
          customerName: 'Клиент',
          customerPhone: '+79001234567'
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Недостаточно');
    });

  });

  describe('GET /api/orders/code/:orderCode', () => {

    it('должен вернуть 404 для несуществующего заказа', async () => {
      const response = await request(app)
        .get('/api/orders/code/999999999') // валидный формат, но несуществующий
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('должен вернуть 400 для заказа с невалидным кодом', async () => {
      const response = await request(app)
        .get('/api/orders/code/abc')
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

  });

});
