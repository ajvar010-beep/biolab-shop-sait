/**
 * Auth Tests - тестирование аутентификации
 */
const request = require('supertest');
const app = require('../backend/server');

describe('Auth Endpoints', () => {

  describe('GET /api/auth/csrf-token', () => {
    it('должен вернуть 200 и csrfToken', async () => {
      const response = await request(app)
        .get('/api/auth/csrf-token')
        .expect(200);

      expect(response.body).toHaveProperty('csrfToken');
      expect(typeof response.body.csrfToken).toBe('string');
      expect(response.body.csrfToken.length).toBeGreaterThan(0);

      // Проверяем что установлен cookie
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('должен вернуть 400 без данных', async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app).get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;

      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfResponse.headers['set-cookie'])
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('должен вернуть 400 без username', async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app).get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;

      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfResponse.headers['set-cookie'])
        .send({ password: 'password123' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('должен вернуть 400 без password', async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app).get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;

      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfResponse.headers['set-cookie'])
        .send({ username: 'admin' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('должен вернуть ошибку с неверными данными', async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app).get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;

      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfResponse.headers['set-cookie'])
        .send({
          username: 'wronguser',
          password: 'wrongpassword'
        });

      // Проверяем что запрос отклонён (не 2xx)
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('message');
    });

    it('должен вернуть ошибку с неправильным паролем', async () => {
      // Получаем CSRF токен
      const csrfResponse = await request(app).get('/api/auth/csrf-token');
      const csrfToken = csrfResponse.body.csrfToken;

      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfResponse.headers['set-cookie'])
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });

      // Проверяем что запрос отклонён (не 2xx)
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('message');
    });
  });

});
