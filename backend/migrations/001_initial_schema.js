/**
 * Миграция 001: Начальная схема базы данных Biolab
 */
module.exports = {
  id: 1,
  name: '001_initial_schema',

  async up(db) {
    // Пользователи (админы)
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS users (
        _id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        tokenVersion INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Категории
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS categories (
        _id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        imageUrl TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Товары
    await db.runMigration(`
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

    // Заказы
    await db.runMigration(`
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

    // Настройки (singleton)
    await db.runMigration(`
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

    console.log('[Миграция] Схема БД создана');
  }
};
