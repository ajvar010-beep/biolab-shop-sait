/**
 * Products Tests - тестирование товаров
 */
const request = require('supertest');
const app = require('../backend/server');

describe('Products Endpoints', () => {

  describe('GET /api/products', () => {
    it('должен вернуть 200 и объект с массивом товаров', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });
  });

  describe('GET /api/products/:id', () => {
    it('должен вернуть 404 для несуществующего товара', async () => {
      const response = await request(app)
        .get('/api/products/nonexistent_product_12345')
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/products', () => {
    it('должен вернуть 401 или 403 без авторизации', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Content-Type', 'application/json')
        .send({
          title: 'Новый товар',
          price: 100
        });

      // 401 (Unauthorized) или 403 (Forbidden) - зависит от middleware
      expect([401, 403]).toContain(response.status);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/products с авторизацией', () => {
    let csrfToken;
    let cookies;
    let adminToken;

    beforeEach(async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app)
        .get('/api/auth/csrf-token');

      csrfToken = csrfResponse.body.csrfToken;
      cookies = csrfResponse.headers['set-cookie'];

      // Логинимся
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookies)
        .send({
          username: 'admin',
          password: 'AdminDemo2026'
        });

      adminToken = loginResponse.body.token;
    });

    it('должен создать товар с валидными данными', async () => {
      // Получаем новый CSRF токен (старый мог устареть)
      const newCsrfResponse = await request(app)
        .get('/api/auth/csrf-token');

      const response = await request(app)
        .post('/api/products')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-CSRF-Token', newCsrfResponse.body.csrfToken)
        .set('Cookie', newCsrfResponse.headers['set-cookie'])
        .send({
          title: 'Тестовый товар',
          description: 'Описание тестового товара',
          price: 999,
          category: 'Тестовые товары',
          stock: 10
        });

      // Может быть 201 или 200 в зависимости от реализации
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('title', 'Тестовый товар');
    });

  });

});
