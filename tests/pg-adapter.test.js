/**
 * Регрессионные тесты PostgreSQL-адаптера: проверяют генерацию SQL и порядок
 * параметров БЕЗ реального подключения (подменяем pool.query).
 * Ловят класс багов, который не виден в SQLite-тестах (там '?' позиционные,
 * а в PG — нумерованные $N, и их легко рассинхронить с массивом параметров).
 */
const db = require('../backend/config/database-pg');

function capturePool() {
  const calls = [];
  db.pool = {
    query: (sql, params) => { calls.push({ sql, params }); return Promise.resolve({ rowCount: 1, rows: [] }); }
  };
  return calls;
}

describe('PostgreSQL adapter SQL generation', () => {
  test('updateOne: SET нумеруется $1.., WHERE — следом, параметры выровнены', async () => {
    const calls = capturePool();
    await db.updateOne(
      'orders',
      { _id: 'oid', status: 'pending' },
      { status: 'completed', completedAt: 'T1', updatedAt: 'T2' }
    );
    const { sql, params } = calls[0];
    expect(sql).toContain('SET status = $1, completedAt = $2, updatedAt = $3');
    expect(sql).toContain('WHERE _id = $4 AND status = $5');
    // $1..$5 должны соответствовать значениям в этом же порядке
    expect(params).toEqual(['completed', 'T1', 'T2', 'oid', 'pending']);
  });

  test('updateOne: один фильтр-ключ', async () => {
    const calls = capturePool();
    await db.updateOne('settings', { _id: 'main' }, { email: 'a@b.c', updatedAt: 'T9' });
    const { sql, params } = calls[0];
    expect(sql).toContain('SET email = $1, updatedAt = $2');
    expect(sql).toContain('WHERE _id = $3');
    expect(params).toEqual(['a@b.c', 'T9', 'main']);
  });

  test('insert: плейсхолдеры в порядке колонок', async () => {
    const calls = capturePool();
    await db.insert('users', { _id: 'u1', username: 'admin', role: 'admin' });
    const { sql, params } = calls[0];
    expect(sql).toContain('VALUES ($1, $2, $3)');
    expect(params).toEqual(['u1', 'admin', 'admin']);
  });

  test('_serialize: null/undefined → NULL, объекты → JSON', () => {
    expect(db._serialize(null)).toBeNull();
    expect(db._serialize(undefined)).toBeNull();
    expect(db._serialize(7)).toBe(7);
    expect(db._serialize('x')).toBe('x');
    expect(db._serialize({ a: 1 })).toBe('{"a":1}');
  });
});
