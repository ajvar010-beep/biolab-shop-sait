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

  // ===== Транзакции (выделенный клиент) =====

  // Начать транзакцию — возвращает клиент, который нужно использовать для запросов внутри транзакции
  async beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  // Зафиксировать транзакцию
  async commit(client) {
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  // Откатить транзакцию
  async rollback(client) {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  // Выполнить запрос внутри транзакции (на конкретном клиенте)
  transactionQuery(client, sql, params = []) {
    return client.query(sql, params);
  }

  // Вставить документ
  async insert(collection, doc, client = null) {
    const fields = Object.keys(doc);
    const values = Object.values(doc).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      if (v === undefined) return null;
      return v;
    });

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
    const filterKeys = Object.keys(filter);
    const filterConditions = filterKeys.map((k, i) => `${this.sanitizeFieldName(k)} = $${i + 1}`).join(' AND ');
    const filterValues = Object.values(filter);

    const updateKeys = Object.keys(update);
    const setClause = updateKeys.map((k, i) => `${this.sanitizeFieldName(k)} = $${filterKeys.length + i + 1}`).join(', ');
    const setValues = updateKeys.map(k => {
      if (typeof update[k] === 'object') return JSON.stringify(update[k]);
      if (update[k] === undefined) return null;
      return update[k];
    });

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
      qrcode: 'qrCode',
      abouttext: 'aboutText',
      workinghours: 'workingHours',
      tokenversion: 'tokenVersion'
    };

    for (const [lower, camel] of Object.entries(fieldMap)) {
      if (parsed[lower] !== undefined && parsed[camel] === undefined) {
        parsed[camel] = parsed[lower];
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
    const allowed = ['users', 'categories', 'products', 'orders', 'settings', '_migrations'];
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

  // Выполнить миграцию (для migrator)
  async runMigration(sql) {
    await this.pool.query(sql);
  }

  // Закрыть соединение
  close() {
    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
  }
}

// Экспорт
const db = new PostgresDB();
module.exports = db;
