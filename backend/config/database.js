/**
 * SQLite Database Layer для Biolab
 * Использует better-sqlite3 — нативный синхронный SQLite для production
 */
const Database = require('better-sqlite3');
const path = require('path');

class SQLiteDB {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  // Инициализация — синхронная (better-sqlite3)
  init(dbPath) {
    this.dbPath = dbPath;

    this.db = new Database(dbPath);

    // WAL-режим для параллельных чтений и лучшей производительности
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');

    console.log('[SQLite] База данных инициализирована:', dbPath);

    // Запускаем миграции
    this.runMigrations();

    return this;
  }

  // Запустить миграции
  runMigrations() {
    const { run } = require('../migrations/migrator');
    run(this);
  }

  // ===== Низкоуровневые примитивы =====

  // Выполнить SQL без результата
  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { changes: result.changes };
    } catch (error) {
      console.error('[SQLite] Run error:', error.message);
      throw error;
    }
  }

  // Выполнить SQL и получить одну строку
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      return row ? this.parseRow(row) : null;
    } catch (error) {
      console.error('[SQLite] Get error:', error.message);
      throw error;
    }
  }

  // Выполнить SQL и получить все строки
  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params).map(r => this.parseRow(r));
      return rows;
    } catch (error) {
      console.error('[SQLite] All error:', error.message);
      throw error;
    }
  }

  // ===== Обёртки для удобства =====

  // Начать транзакцию
  beginTransaction() {
    this.db.exec('BEGIN TRANSACTION');
  }

  // Зафиксировать транзакцию
  commit() {
    this.db.exec('COMMIT');
  }

  // Откатить транзакцию
  rollback() {
    this.db.exec('ROLLBACK');
  }

  // Вставить документ
  insert(collection, doc) {
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

  // Найти один документ
  findOne(collection, query) {
    const table = this.sanitizeTableName(collection);
    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);

    return this.get(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values);
  }

  // Найти все документы
  find(collection, query = {}) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      return this.all(`SELECT * FROM ${table}`);
    }

    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);

    return this.all(`SELECT * FROM ${table} WHERE ${conditions}`, values);
  }

  // Обновить документ
  updateOne(collection, filter, update) {
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

  // Удалить документ
  deleteOne(collection, query) {
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

  // Подсчёт документов
  countDocuments(collection, query = {}) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      const row = this.get(`SELECT COUNT(*) as count FROM ${table}`);
      return row ? row.count : 0;
    }

    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);

    const row = this.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${conditions}`, values);
    return row ? row.count : 0;
  }

  // Парсинг строки (конвертация JSON полей обратно в объекты)
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

  // Выполнить миграцию (создание таблиц)
  runMigration(sql) {
    this.db.exec(sql);
  }


  // Закрыть соединение
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Экспорт синглтона
const db = new SQLiteDB();
module.exports = db;
