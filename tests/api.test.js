/**
 * API Basic Tests - проверка базовых endpoints
 */
const request = require('supertest');

// Импортируем app после setup (setup уже переопределил db)
const app = require('../backend/server');

describe('Basic API Endpoints', () => {

  describe('GET /api/health', () => {
    it('должен вернуть 200 и статус ok', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Health не раскрывает version/тип БД наружу — только статус
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('GET /api/products', () => {
    it('должен вернуть 200 и объект с массивом товаров', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body.products.length).toBe(0);
      expect(response.body).toHaveProperty('total', 0);
    });
  });

  describe('GET /api/categories', () => {
    it('должен вернуть 200 и массив категорий', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // В тестовой БД есть одна категория
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('name');
    });
  });

  describe('GET /api/nonexistent', () => {
    it('должен вернуть 404 для несуществующего endpoint', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });
  });

});
