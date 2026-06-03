/**
 * Jest setup - инициализация тестовой in-memory базы данных
 */
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

// Глобальная тестовая база данных
let testDb = null;

/**
 * Создаёт тестовую in-memory базу с полной схемой
 */
function createTestDatabase() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Таблица пользователей (админы)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      _id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      tokenVersion INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица категорий
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      imageUrl TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица товаров
  db.exec(`
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
    )
  `);

  // Таблица заказов
  db.exec(`
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
    )
  `);

  // Таблица настроек
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      _id TEXT PRIMARY KEY DEFAULT 'main',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      workingHours TEXT DEFAULT '',
      socials TEXT DEFAULT '[]',
      aboutText TEXT DEFAULT '',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица миграций
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

/**
 * Создаёт тестового админа и категорию
 */
async function createTestFixtures() {
  const db = require('../backend/config/database');
  const BCRYPT_ROUNDS = 12;

  // Создаём админа
  const hashedPassword = await bcrypt.hash('AdminDemo2026', BCRYPT_ROUNDS);
  db.insert('users', {
    _id: 'admin_test_001',
    username: 'admin',
    password: hashedPassword,
    role: 'admin',
    tokenVersion: 0
  });

  // Создаём тестовую категорию
  db.insert('categories', {
    _id: 'cat_test_001',
    name: 'Тестовые товары',
    slug: 'test-category',
    description: 'Категория для тестов'
  });
}

/**
 * Очищает все данные из таблиц (для beforeEach)
 * Но НЕ удаляем users и categories - они создаются в beforeAll
 */
function resetDatabase(db) {
  db.exec('DELETE FROM orders');
  db.exec('DELETE FROM products');
  // users и categories создаются в beforeAll и должны персистить
}

// Инициализация перед всеми тестами
beforeAll(async () => {
  testDb = createTestDatabase();

  // Переопределяем внутренние методы синглтона db
  const db = require('../backend/config/database');

  // Переопределяем db.db на тестовую базу
  if (db.db) {
    db.db.close();
  }
  db.db = testDb;
  db.dbPath = ':memory:';

  // Переопределяем методы класса SQLiteDB
  db.get = (sql, params = []) => {
    try {
      const stmt = testDb.prepare(sql);
      const row = stmt.get(...params);
      return row ? db.parseRow(row) : null;
    } catch (error) {
      console.error('[Test DB] Get error:', error.message);
      throw error;
    }
  };

  db.all = (sql, params = []) => {
    try {
      const stmt = testDb.prepare(sql);
      const rows = stmt.all(...params).map(r => db.parseRow(r));
      return rows;
    } catch (error) {
      console.error('[Test DB] All error:', error.message);
      throw error;
    }
  };

  db.run = (sql, params = []) => {
    try {
      const stmt = testDb.prepare(sql);
      const result = stmt.run(...params);
      return { changes: result.changes };
    } catch (error) {
      console.error('[Test DB] Run error:', error.message);
      throw error;
    }
  };

  db.findOne = (collection, query) => {
    const table = db.sanitizeTableName(collection);
    const conditions = Object.keys(query).map(k => `${db.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    return db.get(`SELECT * FROM ${table} WHERE ${conditions} LIMIT 1`, values);
  };

  db.find = (collection, query = {}) => {
    const table = db.sanitizeTableName(collection);
    if (Object.keys(query).length === 0) {
      return db.all(`SELECT * FROM ${table}`);
    }
    const conditions = Object.keys(query).map(k => `${db.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    return db.all(`SELECT * FROM ${table} WHERE ${conditions}`, values);
  };

  db.insert = (collection, doc) => {
    const fields = Object.keys(doc);
    const values = Object.values(doc).map(v => {
      if (typeof v === 'object') return JSON.stringify(v);
      if (v === undefined) return null;
      return v;
    });
    const table = db.sanitizeTableName(collection);
    const placeholders = fields.map(() => '?').join(', ');
    const fieldList = fields.map(f => db.sanitizeFieldName(f)).join(', ');
    try {
      const stmt = testDb.prepare(`INSERT INTO ${table} (${fieldList}) VALUES (${placeholders})`);
      stmt.run(...values);
      return { success: true };
    } catch (error) {
      console.error('[Test DB] Insert error:', error.message);
      throw error;
    }
  };

  db.updateOne = (collection, filter, update) => {
    const table = db.sanitizeTableName(collection);
    const filterConditions = Object.keys(filter).map(k => `${db.sanitizeFieldName(k)} = ?`).join(' AND ');
    const filterValues = Object.values(filter);
    const setClause = Object.keys(update).map(k => `${db.sanitizeFieldName(k)} = ?`).join(', ');
    const setValues = Object.keys(update).map(k => {
      if (typeof update[k] === 'object') return JSON.stringify(update[k]);
      if (update[k] === undefined) return null;
      return update[k];
    });
    try {
      const stmt = testDb.prepare(`UPDATE ${table} SET ${setClause} WHERE ${filterConditions}`);
      const result = stmt.run(...setValues, ...filterValues);
      return { modified: result.changes };
    } catch (error) {
      console.error('[Test DB] Update error:', error.message);
      throw error;
    }
  };

  db.deleteOne = (collection, query) => {
    const table = db.sanitizeTableName(collection);
    const conditions = Object.keys(query).map(k => `${db.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    try {
      const stmt = testDb.prepare(`DELETE FROM ${table} WHERE ${conditions}`);
      const result = stmt.run(...values);
      return { deleted: result.changes };
    } catch (error) {
      console.error('[Test DB] Delete error:', error.message);
      throw error;
    }
  };

  db.countDocuments = (collection, query = {}) => {
    const table = db.sanitizeTableName(collection);
    if (Object.keys(query).length === 0) {
      const row = db.get(`SELECT COUNT(*) as count FROM ${table}`);
      return row ? row.count : 0;
    }
    const conditions = Object.keys(query).map(k => `${db.sanitizeFieldName(k)} = ?`).join(' AND ');
    const values = Object.values(query);
    const row = db.get(`SELECT COUNT(*) as count FROM ${table} WHERE ${conditions}`, values);
    return row ? row.count : 0;
  };

  db.beginTransaction = () => { testDb.exec('BEGIN TRANSACTION'); };
  db.commit = () => { testDb.exec('COMMIT'); };
  db.rollback = () => { testDb.exec('ROLLBACK'); };
  db.runMigration = (sql) => { testDb.exec(sql); };
  db.close = () => { /* Не закрываем in-memory БД */ };

  // Создаём тестовые данные
  await createTestFixtures();

  console.log('[Test Setup] In-memory database configured');
});

// Очистка перед каждым тестом
beforeEach(() => {
  if (testDb) {
    resetDatabase(testDb);
  }
});

// Закрытие после всех тестов
afterAll(() => {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
});

// Экспорт для использования в тестах
global.testDb = testDb;
global.resetDatabase = resetDatabase;
