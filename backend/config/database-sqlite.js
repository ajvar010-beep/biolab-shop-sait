/**
 * SQLite Database Layer для Biolab (local/development)
 * Все методы - async для совместимости с PostgreSQL адаптером.
 * better-sqlite3 подключается лениво в init() — на проде (PostgreSQL) он не нужен.
 */
class SQLiteDB {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  // Инициализация - синхронная (better-sqlite3)
  init(dbPath) {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (err) {
      throw new Error(
        'SQLite-режим требует пакет better-sqlite3. ' +
        'Установите его (npm install better-sqlite3) или задайте DATABASE_URL для PostgreSQL.'
      );
    }

    this.dbPath = dbPath;

    this.db = new Database(dbPath);

    // WAL-режим для параллельных чтений
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');

    console.log('[SQLite] База данных инициализирована:', dbPath);

    return this;
  }

  // Запустить миграции (мигратор асинхронный — возвращаем промис)
  async runMigrations() {
    const { run } = require('../migrations/migrator');
    return run(this);
  }

  // ===== Низкоуровневые примитивы (async) =====

  async run(sql, params = [], client = null) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return { changes: result.changes };
    } catch (error) {
      console.error('[SQLite] Run error:', error.message);
      throw error;
    }
  }

  async get(sql, params = [], client = null) {
    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...(params || []));
      return row ? this.parseRow(row) : null;
    } catch (error) {
      console.error('[SQLite] Get error:', error.message);
      throw error;
    }
  }

  async all(sql, params = [], client = null) {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...(params || [])).map(r => this.parseRow(r));
      return rows;
    } catch (error) {
      console.error('[SQLite] All error:', error.message);
      throw error;
    }
  }

  // ===== Обёртки =====

  // SQLite использует одно соединение, поэтому клиент не нужен — совместимость API
  async beginTransaction() {
    this.db.exec('BEGIN TRANSACTION');
    return null; // нет отдельного клиента
  }

  async commit(client) {
    this.db.exec('COMMIT');
  }

  async rollback(client) {
    this.db.exec('ROLLBACK');
  }

  async insert(collection, doc, client = null) {
    const fields = Object.keys(doc);
    const values = Object.values(doc).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      if (v === undefined) return null;
      return v;
    });

    const table = this.sanitizeTableName(collection);
    const placeholders = fields.map(() => '?').join(', ');
    const fieldList = fields.map(f => this.sanitizeFieldName(f)).join(', ');

    try {
      const stmt = this.db.prepare(`INSERT INTO ${table} (${fieldList}) VALUES (${placeholders})`);
      stmt.run(...values);
      return { success: true };
    } catch (error) {
      console.error('[SQLite] Insert error:', error.message);
      throw error;
    }
  }

  async findOne(collection, query, client = null) {
    const table = this.sanitizeTableName(collection);
    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    return this.get(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values);
  }

  async find(collection, query = {}, client = null) {
    const table = this.sanitizeTableName(collection);
    if (Object.keys(query).length === 0) {
      return this.all(`SELECT * FROM ${table}`);
    }
    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    return this.all(`SELECT * FROM ${table} WHERE ${conditions}`, values);
  }

  async updateOne(collection, filter, update, client = null) {
    const table = this.sanitizeTableName(collection);
    const filterConditions = Object.keys(filter).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const filterValues = Object.values(filter);
    const setClause = Object.keys(update).map(k => `${this.sanitizeFieldName(k)} = ?`).join(', ');
    const setValues = Object.keys(update).map(k => {
      if (typeof update[k] === 'object') return JSON.stringify(update[k]);
      if (update[k] === undefined) return null;
      return update[k];
    });

    try {
      const stmt = this.db.prepare(`UPDATE ${table} SET ${setClause} WHERE ${filterConditions}`);
      const result = stmt.run(...setValues, ...filterValues);
      return { modified: result.changes };
    } catch (error) {
      console.error('[SQLite] Update error:', error.message);
      throw error;
    }
  }

  async deleteOne(collection, query, client = null) {
    const table = this.sanitizeTableName(collection);
    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    try {
      const stmt = this.db.prepare(`DELETE FROM ${table} WHERE ${conditions}`);
      const result = stmt.run(...values);
      return { deleted: result.changes };
    } catch (error) {
      console.error('[SQLite] Delete error:', error.message);
      throw error;
    }
  }

  async countDocuments(collection, query = {}, client = null) {
    const table = this.sanitizeTableName(collection);
    if (Object.keys(query).length === 0) {
      const row = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
      return row ? row.count : 0;
    }
    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    const row = await this.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${conditions}`, values);
    return row ? row.count : 0;
  }

  parseRow(row) {
    if (!row) return null;
    const parsed = { ...row };
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

  sanitizeTableName(name) {
    const allowed = ['users', 'categories', 'products', 'orders', 'settings', '_migrations'];
    if (!allowed.includes(name)) {
      throw new Error('Invalid table name: ' + name);
    }
    return name;
  }

  sanitizeFieldName(name) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Invalid field name: ' + name);
    }
    return name;
  }

  async runMigration(sql) {
    this.db.exec(sql);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

const db = new SQLiteDB();
module.exports = db;
