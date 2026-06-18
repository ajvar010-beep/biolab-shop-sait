/**
 * PostgreSQL Database Layer для Biolab
 * Использует pg (node-postgres) для production на Render
 */
const { Pool } = require('pg');

class PostgresDB {
  constructor() {
    this.pool = null;
  }

  // Инициализация - асинхронная
  init(dbPath) {
    const connectionString = process.env.DATABASE_URL;

    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQL] Неожиданная ошибка пула:', err.message);
    });

    console.log('[PostgreSQL] Подключение к базе данных...');

    return this;
  }

  // Запустить миграции (создать таблицы)
  async runMigrations() {
    const { run } = require('../migrations/migrator-pg');
    await run(this);
  }

  // Выполнить SQL без результата
  async run(sql, params = [], client = null) {
    try {
      const executor = client || this.pool;
      const result = await executor.query(sql, params);
      return { changes: result.rowCount };
    } catch (error) {
      console.error('[PostgreSQL] Run error:', error.message);
      throw error;
    }
  }

  // Выполнить SQL и получить одну строку
  async get(sql, params = [], client = null) {
    try {
      const executor = client || this.pool;
      const result = await executor.query(sql, params);
      const row = result.rows[0];
      return row ? this.parseRow(row) : null;
    } catch (error) {
      console.error('[PostgreSQL] Get error:', error.message);
      throw error;
    }
  }

  // Выполнить SQL и получить все строки
  async all(sql, params = [], client = null) {
    try {
      const executor = client || this.pool;
      const result = await executor.query(sql, params);
      return result.rows.map(r => this.parseRow(r));
    } catch (error) {
      console.error('[PostgreSQL] All error:', error.message);
      throw error;
    }
  }

  // Привести JS-значение к виду, пригодному для pg-параметра.
  // ВАЖНО: null/undefined проверяются ПЕРВЫМИ — typeof null === 'object',
  // иначе null уходит в БД как строка 'null' и ломает числовые/timestamp-колонки.
  _serialize(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  }

  // Освободить клиент в пул ровно один раз (защита от двойного release,
  // когда после неудачного commit вызывается rollback на том же клиенте).
  _safeRelease(client) {
    if (client && !client._biolabReleased) {
      client._biolabReleased = true;
      client.release();
    }
  }

  // ===== Транзакции (выделенный клиент) =====

  // Начать транзакцию — возвращает клиент, который нужно использовать для запросов внутри транзакции
  async beginTransaction() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
    } catch (err) {
      // Если BEGIN упал — обязательно вернуть клиент в пул, иначе утечка соединения
      this._safeRelease(client);
      throw err;
    }
    return client;
  }

  // Зафиксировать транзакцию
  async commit(client) {
    try {
      await client.query('COMMIT');
    } finally {
      this._safeRelease(client);
    }
  }

  // Откатить транзакцию. Толерантна к ошибкам и к уже освобождённому клиенту,
  // чтобы не маскировать исходную ошибку из catch-блока контроллера.
  async rollback(client) {
    if (!client) return;
    try {
      if (!client._biolabReleased) {
        await client.query('ROLLBACK');
      }
    } catch (err) {
      console.error('[PostgreSQL] Rollback error:', err.message);
    } finally {
      this._safeRelease(client);
    }
  }

  // Выполнить запрос внутри транзакции (на конкретном клиенте)
  transactionQuery(client, sql, params = []) {
    return client.query(sql, params);
  }

  // Атомарно уменьшить остаток с проверкой наличия в одном запросе.
  // Возвращает {changes}: 0 — если товара не хватило (защита от перепродажи при гонке).
  async decrementStock(productId, qty, client = null) {
    const executor = client || this.pool;
    const result = await executor.query(
      'UPDATE products SET stock = stock - $1 WHERE _id = $2 AND stock >= $1',
      [qty, productId]
    );
    return { changes: result.rowCount };
  }

  // Атомарно вернуть остаток на склад (откат заказа).
  async incrementStock(productId, qty, client = null) {
    const executor = client || this.pool;
    const result = await executor.query(
      'UPDATE products SET stock = stock + $1 WHERE _id = $2',
      [qty, productId]
    );
    return { changes: result.rowCount };
  }

  // Вставить документ
  async insert(collection, doc, client = null) {
    const fields = Object.keys(doc);
    const values = Object.values(doc).map(v => this._serialize(v));

    const table = this.sanitizeTableName(collection);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const fieldList = fields.map(f => this.sanitizeFieldName(f)).join(', ');

    try {
      const executor = client || this.pool;
      await executor.query(
        `INSERT INTO ${table} (${fieldList}) VALUES (${placeholders})`,
        values
      );
      return { success: true };
    } catch (error) {
      console.error('[PostgreSQL] Insert error:', error.message);
      throw error;
    }
  }

  // Найти один документ
  async findOne(collection, query, client = null) {
    const table = this.sanitizeTableName(collection);
    const conditions = Object.keys(query).map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(' AND ');
    const values = Object.values(query);

    return this.get(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values, client);
  }

  // Найти все документы
  async find(collection, query = {}, client = null) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      return this.all(`SELECT * FROM ${table}`, [], client);
    }

    const conditions = Object.keys(query).map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(' AND ');
    const values = Object.values(query);

    return this.all(`SELECT * FROM ${table} WHERE ${conditions}`, values, client);
  }

  // Обновить документ
  async updateOne(collection, filter, update, client = null) {
    const table = this.sanitizeTableName(collection);

    // ВАЖНО: порядок параметров — [...setValues, ...filterValues], поэтому
    // SET нумеруем ПЕРВЫМ ($1..), а WHERE — следующими номерами. Иначе значения
    // SET и WHERE меняются местами (id уходит в timestamp-колонку → ошибка на PG).
    const updateKeys = Object.keys(update);
    const setClause = updateKeys.map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(', ');
    const setValues = updateKeys.map(k => this._serialize(update[k]));

    const filterKeys = Object.keys(filter);
    const filterConditions = filterKeys.map((k, i) => `${this.sanitizeFieldName(k)} = $${updateKeys.length + i + 1}`).join(' AND ');
    const filterValues = Object.values(filter);

    try {
      const executor = client || this.pool;
      const result = await executor.query(
        `UPDATE ${table} SET ${setClause} WHERE ${filterConditions}`,
        [...setValues, ...filterValues]
      );
      return { modified: result.rowCount };
    } catch (error) {
      console.error('[PostgreSQL] Update error:', error.message);
      throw error;
    }
  }

  // Удалить документ
  async deleteOne(collection, query, client = null) {
    const table = this.sanitizeTableName(collection);
    const conditions = Object.keys(query).map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(' AND ');
    const values = Object.values(query);

    try {
      const executor = client || this.pool;
      const result = await executor.query(`DELETE FROM ${table} WHERE ${conditions}`, values);
      return { deleted: result.rowCount };
    } catch (error) {
      console.error('[PostgreSQL] Delete error:', error.message);
      throw error;
    }
  }

  // Подсчёт документов
  async countDocuments(collection, query = {}, client = null) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      const row = await this.get(`SELECT COUNT(*) as count FROM ${table}`, [], client);
      return row ? parseInt(row.count, 10) : 0;
    }

    const conditions = Object.keys(query).map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(' AND ');
    const values = Object.values(query);

    const row = await this.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${conditions}`, values, client);
    return row ? parseInt(row.count, 10) : 0;
  }

  // Парсинг строки — конвертирует lowercase поля PostgreSQL в camelCase
  parseRow(row) {
    if (!row) return null;
    const parsed = { ...row };

    // Маппинг lowercase → camelCase для совместимости с фронтендом
    const fieldMap = {
      imageurl: 'imageUrl',
      modelurl: 'modelUrl',
      saleprice: 'salePrice',
      salestart: 'saleStart',
      saleend: 'saleEnd',
      createdat: 'createdAt',
      updatedat: 'updatedAt',
      ordercode: 'orderCode',
      customername: 'customerName',
      customerphone: 'customerPhone',
      customeremail: 'customerEmail',
      totalprice: 'totalPrice',
      totalamount: 'totalAmount',
      completedat: 'completedAt',
      cancelledat: 'cancelledAt',
      cancelreason: 'cancelReason',
      abouttext: 'aboutText',
      workinghours: 'workingHours',
      tokenversion: 'tokenVersion',
      // audit_log
      actorid: 'actorId',
      actorname: 'actorName',
      actorlevel: 'actorLevel',
      targettype: 'targetType',
      targetid: 'targetId',
      targetlabel: 'targetLabel'
    };

    // Маппим lowercase → camelCase и УДАЛЯЕМ исходный lowercase-ключ.
    // Иначе строка содержит оба ключа (workinghours + workingHours), и если
    // её целиком передать обратно в updateOne, PG свернёт неэкранированные
    // имена в одну колонку → ошибка 42601 "multiple assignments to same column".
    for (const [lower, camel] of Object.entries(fieldMap)) {
      if (parsed[lower] !== undefined) {
        if (parsed[camel] === undefined) parsed[camel] = parsed[lower];
        delete parsed[lower];
      }
    }

    if (parsed.images && typeof parsed.images === 'string') {
      try { parsed.images = JSON.parse(parsed.images); } catch (_) { parsed.images = []; }
    }
    if (parsed.items && typeof parsed.items === 'string') {
      try { parsed.items = JSON.parse(parsed.items); } catch (_) { parsed.items = []; }
    }
    if (parsed.socials && typeof parsed.socials === 'string') {
      try { parsed.socials = JSON.parse(parsed.socials); } catch (_) { parsed.socials = []; }
    }

    return parsed;
  }

  // Защита от SQL-инъекций в именах таблиц
  sanitizeTableName(name) {
    const allowed = ['users', 'categories', 'products', 'orders', 'settings', 'audit_log', '_migrations'];
    if (!allowed.includes(name)) {
      throw new Error('Invalid table name: ' + name);
    }
    return name;
  }

  // Защита от SQL-инъекций в именах полей
  sanitizeFieldName(name) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Invalid field name: ' + name);
    }
    return name;
  }

  // Выполнить миграцию (для migrator). Если задан _migrationClient —
  // выполняем на нём, чтобы вся миграция шла в одной транзакции.
  async runMigration(sql) {
    const executor = this._migrationClient || this.pool;
    await executor.query(sql);
  }

  // Закрыть пул. Ждём завершения активных запросов (pool.end() возвращает промис).
  async close() {
    if (this.pool) {
      const pool = this.pool;
      this.pool = null;
      try {
        await pool.end();
      } catch (err) {
        console.error('[PostgreSQL] Ошибка закрытия пула:', err.message);
      }
    }
  }
}

// Экспорт
const db = new PostgresDB();
module.exports = db;
