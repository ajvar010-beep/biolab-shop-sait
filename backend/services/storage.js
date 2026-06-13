/**
 * Сервис хранения файлов для Biolab Shop
 * Поддерживает локальное хранение и S3-совместимое хранилище (Selectel и др.)
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Тип хранилища: 'local' или 's3'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Путь к папке для локального хранения.
// ВАЖНО: должен совпадать с тем, что раздаёт server.js (корень репозитория /uploads),
// иначе загруженные файлы сохранятся, но по своему URL вернут 404 / index.html.
// __dirname = backend/services → поднимаемся на два уровня в корень проекта.
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

/**
 * Базовый класс хранилища
 */
class BaseStorage {
  /**
   * Загрузить файл
   * @param {Buffer} buffer - данные файла
   * @param {string} filename - оригинальное имя файла
   * @param {string} mimetype - MIME-тип файла
   * @returns {Promise<{url: string}>} - URL загруженного файла
   */
  async uploadFile(buffer, filename, mimetype) {
    throw new Error('Метод uploadFile должен быть реализован');
  }

  /**
   * Удалить файл
   * @param {string} url - URL файла
   * @returns {Promise<void>}
   */
  async deleteFile(url) {
    throw new Error('Метод deleteFile должен быть реализован');
  }

  /**
   * Получить тип хранилища
   * @returns {'local' | 's3'}
   */
  getStorageType() {
    throw new Error('Метод getStorageType должен быть реализован');
  }
}

/**
 * Локальное хранилище файлов (для разработки)
 */
class LocalStorage extends BaseStorage {
  constructor() {
    super();
    // Создаём папку uploads, если её нет
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log('[Storage] Создана папка для локального хранения:', UPLOADS_DIR);
    }
  }

  /**
   * Загрузить файл в локальное хранилище
   */
  async uploadFile(buffer, filename, mimetype) {
    try {
      // Генерируем уникальное имя файла: timestamp + random + оригинальное расширение
      const ext = path.extname(filename);
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);

      // Записываем файл
      fs.writeFileSync(filePath, buffer);
      console.log('[Storage/Local] Файл сохранён:', uniqueName);

      // Возвращаем относительный URL
      const url = `/uploads/${uniqueName}`;
      return { url };
    } catch (error) {
      console.error('[Storage/Local] Ошибка при сохранении файла:', error.message);
      throw new Error(`Не удалось сохранить файл: ${error.message}`);
    }
  }

  /**
   * Удалить файл из локального хранилища
   */
  async deleteFile(url) {
    try {
      // Извлекаем имя файла из URL
      const filename = path.basename(url);
      const filePath = path.join(UPLOADS_DIR, filename);

      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        console.warn('[Storage/Local] Файл не найден:', filename);
        return;
      }

      // Удаляем файл
      fs.unlinkSync(filePath);
      console.log('[Storage/Local] Файл удалён:', filename);
    } catch (error) {
      console.error('[Storage/Local] Ошибка при удалении файла:', error.message);
      throw new Error(`Не удалось удалить файл: ${error.message}`);
    }
  }

  /**
   * Получить тип хранилища
   */
  getStorageType() {
    return 'local';
  }
}

/**
 * S3-совместимое хранилище (Selectel, AWS S3 и др.)
 */
class S3Storage extends BaseStorage {
  constructor() {
    super();

    // Проверяем обязательные переменные окружения
    const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_REGION'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.warn('[Storage/S3] Внимание: отсутствуют переменные окружения:', missing.join(', '));
      console.warn('[Storage/S3] Будет использоваться демо-режим без реальной загрузки');
    }

    // Инициализируем S3 клиент
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'ru-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      },
      // Для Selectel и некоторых S3-совместимых хранилищ
      forcePathStyle: true,
    });

    this.bucket = process.env.S3_BUCKET || '';
    this.endpoint = process.env.S3_ENDPOINT || '';

    console.log('[Storage/S3] Инициализировано хранилище:', this.bucket);
  }

  /**
   * Загрузить файл в S3
   */
  async uploadFile(buffer, filename, mimetype) {
    try {
      // Генерируем уникальный ключ объекта
      const ext = path.extname(filename);
      const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        // Делаем файл публично доступным
        ACL: 'public-read',
      });

      await this.s3Client.send(command);
      console.log('[Storage/S3] Файл загружен:', key);

      // Формируем публичный URL
      const url = `${this.endpoint}/${this.bucket}/${key}`;
      return { url };
    } catch (error) {
      console.error('[Storage/S3] Ошибка при загрузке файла:', error.message);
      throw new Error(`Не удалось загрузить файл в S3: ${error.message}`);
    }
  }

  /**
   * Удалить файл из S3
   */
  async deleteFile(url) {
    try {
      // Извлекаем ключ из URL
      // URL может быть вида: https://endpoint/bucket/key или https://endpoint/key
      const urlObj = new URL(url);
      let key = urlObj.pathname;

      // Убираем начальный слэш и возможный префикс bucket
      key = key.replace(/^\//, '');
      const pathParts = key.split('/');
      if (pathParts[0] === this.bucket) {
        pathParts.shift();
        key = pathParts.join('/');
      }

      if (!key) {
        console.warn('[Storage/S3] Не удалось извлечь ключ из URL:', url);
        return;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log('[Storage/S3] Файл удалён:', key);
    } catch (error) {
      console.error('[Storage/S3] Ошибка при удалении файла:', error.message);
      throw new Error(`Не удалось удалить файл из S3: ${error.message}`);
    }
  }

  /**
   * Получить тип хранилища
   */
  getStorageType() {
    return 's3';
  }
}

// Экспорт единственного экземпляра хранилища в зависимости от настройки
let storage;

switch (STORAGE_TYPE) {
  case 's3':
    storage = new S3Storage();
    console.log('[Storage] Используется S3-хранилище');
    break;
  case 'local':
  default:
    storage = new LocalStorage();
    console.log('[Storage] Используется локальное хранилище');
    break;
}

module.exports = storage;
