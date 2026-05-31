/**
 * SQLite Database Layer для Biolab
 * Использует sql.js (WebAssembly) - не требует дополнительных библиотек
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class SQLiteDB {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.SQL = null;
  }

  async init(dbPath) {
    this.dbPath = dbPath;

    // Инициализируем SQL.js
    this.SQL = await initSqlJs();

    // Загружаем существующую базу или создаём новую
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
      this.createTables();
    }

    console.log('[SQLite] База данных инициализирована:', dbPath);
    return this;
  }

  createTables() {
    this.db.run(`
      -- Пользователи (админы)
      CREATE TABLE IF NOT EXISTS users (
        _id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        tokenVersion INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Категории
      CREATE TABLE IF NOT EXISTS categories (
        _id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        imageUrl TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Товары
      CREATE TABLE IF NOT EXISTS products (
        _id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT,
        imageUrl TEXT,
        images TEXT,
        modelUrl TEXT,
        stock INTEGER DEFAULT 0,
        size TEXT,
        salePrice REAL,
        saleStart TEXT,
        saleEnd TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Заказы
      CREATE TABLE IF NOT EXISTS orders (
        _id TEXT PRIMARY KEY,
        orderCode TEXT UNIQUE NOT NULL,
        customerName TEXT NOT NULL,
        customerPhone TEXT NOT NULL,
        customerEmail TEXT,
        items TEXT NOT NULL,
        totalPrice REAL NOT NULL,
        totalAmount REAL,
        status TEXT DEFAULT 'pending',
        completedAt TEXT,
        cancelledAt TEXT,
        cancelReason TEXT,
        qrCode TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Настройки (singleton)
      CREATE TABLE IF NOT EXISTS settings (
        _id TEXT PRIMARY KEY DEFAULT 'main',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        address TEXT DEFAULT '',
        workingHours TEXT DEFAULT '',
        socials TEXT DEFAULT '[]',
        aboutText TEXT DEFAULT '',
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.save();
  }

  // Сохранить базу на диск
  save() {
    if (!this.db || !this.dbPath) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
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
      this.db.run(
        `INSERT INTO ${table} (${fieldList}) VALUES (${placeholders})`,
        values
      );
      this.save();
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

    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`);
    stmt.bind(values);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.parseRow(row);
    }
    stmt.free();
    return null;
  }

  // Найти все документы
  find(collection, query = {}) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      const results = [];
      const stmt = this.db.prepare(`SELECT * FROM ${table}`);
      while (stmt.step()) {
        results.push(this.parseRow(stmt.getAsObject()));
      }
      stmt.free();
      return results;
    }

    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);

    const results = [];
    const stmt = this.db.prepare(`SELECT * FROM ${table} WHERE ${conditions}`);
    stmt.bind(values);
    while (stmt.step()) {
      results.push(this.parseRow(stmt.getAsObject()));
    }
    stmt.free();
    return results;
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
      this.db.run(
        `UPDATE ${table} SET ${setClause} WHERE ${filterConditions}`,
        [...setValues, ...filterValues]
      );
      this.save();
      return { modified: this.db.getRowsModified() };
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
      this.db.run(`DELETE FROM ${table} WHERE ${conditions}`, values);
      this.save();
      return { deleted: this.db.getRowsModified() };
    } catch (error) {
      console.error('[SQLite] Delete error:', error.message);
      throw error;
    }
  }

  // Подсчёт документов
  countDocuments(collection, query = {}) {
    const table = this.sanitizeTableName(collection);

    if (Object.keys(query).length === 0) {
      const result = this.db.exec(`SELECT COUNT(*) as count FROM ${table}`);
      return result.length > 0 ? result[0].values[0][0] : 0;
    }

    const conditions = Object.keys(query).map(k => `${this.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);

    // Используем prepared statement для подсчёта
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${conditions}`);
    stmt.bind(values);
    let count = 0;
    if (stmt.step()) {
      count = stmt.get()[0];
    }
    stmt.free();
    return count;
  }

  // Парсинг строки (конвертация JSON полей обратно в объекты)
  parseRow(row) {
    if (!row) return null;
    const parsed = { ...row };

    // Поля images и items могут быть JSON строками
    if (parsed.images && typeof parsed.images === 'string') {
      try {
        parsed.images = JSON.parse(parsed.images);
      } catch (e) {}
    }
    if (parsed.items && typeof parsed.items === 'string') {
      try {
        parsed.items = JSON.parse(parsed.items);
      } catch (e) {}
    }

    return parsed;
  }

  // Защита от SQL инъекций в именах таблиц
  sanitizeTableName(name) {
    const allowed = ['users', 'categories', 'products', 'orders', 'settings'];
    if (!allowed.includes(name)) {
      throw new Error('Invalid table name: ' + name);
    }
    return name;
  }

  // Защита от SQL инъекций в именах полей
  sanitizeFieldName(name) {
    // Разрешаем только буквы, цифры и подчёркивания
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error('Invalid field name: ' + name);
    }
    return name;
  }

  // Закрыть соединение
  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// Экспорт синглтона
const db = new SQLiteDB();

module.exports = db;
