/**
 * Database Layer для Biolab
 * Поддерживает SQLite (better-sqlite3) и PostgreSQL (pg)
 * Выбор: DATABASE_URL задан → PostgreSQL, иначе → better-sqlite3
 */
require('dotenv').config();

const dbType = process.env.DATABASE_URL ? 'pg' : 'sqlite';

if (dbType === 'pg') {
  module.exports = require('./database-pg');
} else {
  module.exports = require('./database-sqlite');
}
