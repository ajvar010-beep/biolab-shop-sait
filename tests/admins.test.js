/**
 * Admin Levels Tests — проверка уровней доступа и иерархии управления аккаунтами.
 *
 * Фикстура-админ (admin / AdminDemo2026) — уровень 3 (владелец), задаётся в tests/setup.js.
 * Пользователи НЕ сбрасываются между тестами (resetDatabase чистит только products/orders),
 * поэтому аккаунты создаём один раз в beforeAll.
 */
const request = require('supertest');
const app = require('../backend/server');

function getCsrf() {
  return request(app).get('/api/auth/csrf-token').then(r => ({
    token: r.body.csrfToken,
    cookies: r.headers['set-cookie']
  }));
}

async function login(username, password) {
  const { token, cookies } = await getCsrf();
  return request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .set('X-CSRF-Token', token)
    .set('Cookie', cookies)
    .send({ username, password });
}

// Мутация с авторизацией: свежий CSRF + Bearer на каждый запрос.
async function mutate(method, path, jwt, body) {
  const { token, cookies } = await getCsrf();
  let req = request(app)[method](path)
    .set('Authorization', `Bearer ${jwt}`)
    .set('X-CSRF-Token', token)
    .set('Cookie', cookies);
  if (body !== undefined) req = req.set('Content-Type', 'application/json').send(body);
  return req;
}

function authGet(path, jwt) {
  return request(app).get(path).set('Authorization', `Bearer ${jwt}`);
}

describe('Уровни доступа админки', () => {
  let ownerJwt, ownerId;
  let l1Jwt, l2Jwt, l2Id;
  let selfPwJwt;

  beforeAll(async () => {
    const ownerLogin = await login('admin', 'AdminDemo2026');
    ownerJwt = ownerLogin.body.token;
    ownerId = ownerLogin.body.admin.id;

    // Владелец создаёт аккаунты разных уровней
    await mutate('post', '/api/admins', ownerJwt, { username: 'emp_l1', password: 'workerpass1', level: 1 });
    await mutate('post', '/api/admins', ownerJwt, { username: 'emp_l2', password: 'managerpass2', level: 2 });
    await mutate('post', '/api/admins', ownerJwt, { username: 'victim_a', password: 'victimpass1', level: 1 });
    await mutate('post', '/api/admins', ownerJwt, { username: 'self_pw', password: 'selfpass123', level: 1 });

    l1Jwt = (await login('emp_l1', 'workerpass1')).body.token;
    const l2 = await login('emp_l2', 'managerpass2');
    l2Jwt = l2.body.token;
    l2Id = l2.body.admin.id;
    selfPwJwt = (await login('self_pw', 'selfpass123')).body.token;
  });

  it('владелец входит с уровнем 3', async () => {
    const r = await login('admin', 'AdminDemo2026');
    expect(r.body.admin.level).toBe(3);
  });

  it('обычный админ входит с уровнем 1', async () => {
    const r = await login('emp_l1', 'workerpass1');
    expect(r.body.admin.level).toBe(1);
  });

  // ===== Уровень 1 =====
  it('ур.1 может выложить товар', async () => {
    const r = await mutate('post', '/api/products', l1Jwt, {
      title: 'Апельсины', description: 'Сочные апельсины', price: 100, category: 'Тестовые товары', stock: 5
    });
    expect([200, 201]).toContain(r.status);
  });

  it('ур.1 НЕ может редактировать товар (403)', async () => {
    const created = await mutate('post', '/api/products', ownerJwt, {
      title: 'Яблоки', description: 'Хрустящие яблоки', price: 50, category: 'Тестовые товары', stock: 5
    });
    const r = await mutate('put', `/api/products/${created.body._id}`, l1Jwt, { price: 60 });
    expect(r.status).toBe(403);
  });

  it('ур.1 НЕ может менять настройки магазина (403)', async () => {
    const r = await mutate('put', '/api/settings', l1Jwt, { address: 'ул. Тестовая, 1' });
    expect(r.status).toBe(403);
  });

  it('ур.1 НЕ видит список админов (403)', async () => {
    const r = await authGet('/api/admins', l1Jwt);
    expect(r.status).toBe(403);
  });

  it('ур.1 НЕ может создавать аккаунты (403)', async () => {
    const r = await mutate('post', '/api/admins', l1Jwt, { username: 'hacker1', password: 'hackerpass1', level: 1 });
    expect(r.status).toBe(403);
  });

  it('ур.1 НЕ видит журнал действий (403)', async () => {
    const r = await authGet('/api/audit', l1Jwt);
    expect(r.status).toBe(403);
  });

  // ===== Уровень 2 =====
  it('ур.2 может редактировать товар', async () => {
    const created = await mutate('post', '/api/products', ownerJwt, {
      title: 'Груши', description: 'Спелые груши', price: 70, category: 'Тестовые товары', stock: 5
    });
    const r = await mutate('put', `/api/products/${created.body._id}`, l2Jwt, { price: 80 });
    expect(r.status).toBe(200);
  });

  it('ур.2 может менять настройки магазина', async () => {
    const r = await mutate('put', '/api/settings', l2Jwt, { address: 'ул. Менеджера, 2' });
    expect(r.status).toBe(200);
  });

  it('ур.2 видит управляемые аккаунты (ниже себя + себя, без владельца)', async () => {
    const r = await authGet('/api/admins', l2Jwt);
    expect(r.status).toBe(200);
    const names = r.body.admins.map(a => a.username);
    expect(names).toContain('emp_l1');
    expect(names).toContain('emp_l2');
    expect(names).not.toContain('admin'); // владелец (ур.3) скрыт
  });

  it('ур.2 НЕ может создавать аккаунты — нужен ур.3 (403)', async () => {
    const r = await mutate('post', '/api/admins', l2Jwt, { username: 'newbie1', password: 'newbiepass1', level: 1 });
    expect(r.status).toBe(403);
  });

  it('ур.2 может удалить аккаунт ниже себя', async () => {
    const list = await authGet('/api/admins', ownerJwt);
    const victim = list.body.admins.find(a => a.username === 'victim_a');
    const r = await mutate('delete', `/api/admins/${victim.id}`, l2Jwt);
    expect(r.status).toBe(200);
  });

  it('ур.2 НЕ может управлять владельцем ур.3 (403)', async () => {
    const r = await mutate('put', `/api/admins/${ownerId}/password`, l2Jwt, { password: 'hacked12345' });
    expect(r.status).toBe(403);
  });

  it('ур.2 НЕ может управлять собой через /admins/:id (400)', async () => {
    const r = await mutate('put', `/api/admins/${l2Id}/password`, l2Jwt, { password: 'newselfpass1' });
    expect(r.status).toBe(400);
  });

  // ===== Уровень 3 (владелец) =====
  it('владелец НЕ может назначить уровень не ниже своего (403)', async () => {
    const list = await authGet('/api/admins', ownerJwt);
    const emp = list.body.admins.find(a => a.username === 'emp_l1');
    const r = await mutate('put', `/api/admins/${emp.id}/level`, ownerJwt, { level: 3 });
    expect(r.status).toBe(403);
  });

  it('владелец может создать менеджера и обычного админа', async () => {
    const r1 = await mutate('post', '/api/admins', ownerJwt, { username: 'extra_l1', password: 'extrapass1', level: 1 });
    const r2 = await mutate('post', '/api/admins', ownerJwt, { username: 'extra_l2', password: 'extrapass2', level: 2 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  // ===== Свой пароль =====
  it('любой админ может сменить свой пароль', async () => {
    const r = await mutate('post', '/api/admins/me/password', selfPwJwt, {
      currentPassword: 'selfpass123', newPassword: 'newselfpass123'
    });
    expect(r.status).toBe(200);
    const relog = await login('self_pw', 'newselfpass123');
    expect(relog.body.admin.level).toBe(1);
  });

  it('смена своего пароля с неверным текущим — 400', async () => {
    const r = await mutate('post', '/api/admins/me/password', l2Jwt, {
      currentPassword: 'wrongpassword', newPassword: 'whatever12345'
    });
    expect(r.status).toBe(400);
  });

  // ===== Журнал =====
  it('ур.2 видит в журнале действия ур.1', async () => {
    // Действие ур.1 → должно попасть в журнал
    await mutate('post', '/api/products', l1Jwt, {
      title: 'Лимоны', description: 'Кислые лимоны', price: 90, category: 'Тестовые товары', stock: 3
    });
    const r = await authGet('/api/audit', l2Jwt);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.entries)).toBe(true);
    expect(r.body.entries.some(e => Number(e.actorLevel) === 1)).toBe(true);
  });
});
