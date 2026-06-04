/**
 * PostgreSQL миграция 001: Начальная схема базы данных Biolab
 */
module.exports = {
  id: 1,
  name: '001_initial_schema',

  async up(db) {
    // Пользователи (админы)
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS users (
        _id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        tokenVersion INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Категории
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS categories (
        _id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255),
        description TEXT,
        imageUrl TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Товары
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS products (
        _id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category VARCHAR(255),
        imageUrl TEXT,
        images TEXT,
        modelUrl TEXT,
        stock INTEGER DEFAULT 0,
        size VARCHAR(50),
        salePrice REAL,
        saleStart TIMESTAMP,
        saleEnd TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Заказы
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS orders (
        _id VARCHAR(255) PRIMARY KEY,
        orderCode VARCHAR(255) UNIQUE NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(255) NOT NULL,
        customerEmail VARCHAR(255),
        items TEXT NOT NULL,
        totalPrice REAL NOT NULL,
        totalAmount REAL,
        status VARCHAR(50) DEFAULT 'pending',
        completedAt TIMESTAMP,
        cancelledAt TIMESTAMP,
        cancelReason TEXT,
        qrCode TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Настройки (singleton)
    await db.runMigration(`
      CREATE TABLE IF NOT EXISTS settings (
        _id VARCHAR(255) PRIMARY KEY DEFAULT 'main',
        email VARCHAR(255) DEFAULT '',
        phone VARCHAR(255) DEFAULT '',
        address TEXT DEFAULT '',
        workingHours TEXT DEFAULT '',
        socials TEXT DEFAULT '[]',
        aboutText TEXT DEFAULT '',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[Миграция] PostgreSQL схема БД создана');
  }
};
