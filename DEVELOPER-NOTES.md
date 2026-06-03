# 📝 Памятка для разработчика

**Обновлено:** 03.06.2026
**Версия:** Biolab v1.3.0
**База данных:** SQLite (better-sqlite3)

## 🚨 Критические моменты безопасности

### Перед любыми изменениями:
- ✅ Всегда используйте транзакции SQLite для операций с остатками (`db.beginTransaction()` → `db.commit()` / `db.rollback()`)
- ✅ Санитизируйте все пользовательские данные
- ✅ Проверяйте CSRF токены в админке
- ✅ Не увеличивайте лимиты без необходимости

### Файлы, требующие особой осторожности:
- `backend/controllers/orderController.js` — логика заказов (транзакции!)
- `assets/js/shop.js` — отображение данных (XSS защита!)
- `admin/js/auth.js` — авторизация (CSRF токены!)
- `backend/middleware/security.js` — настройки безопасности
- `backend/config/database.js` — транзакции, валидация запросов

## 🔧 Быстрые команды

```bash
# Проверить зависимости на уязвимости
npm audit

# Запустить сервер (development с авто-рестартом)
npm run dev

# Запустить сервер (production)
npm start

# Запустить тесты
npm test
npm run test:watch

# Создать админа
node scripts/create-admin.js

# Сгенерировать sitemap
npm run sitemap

# Сделать бэкап БД
npm run backup

# Посмотреть логи (если есть logs.txt)
npm run logs

# Очистить DNS (если меняли IP)
ipconfig /flushdns
```

## ⚠️ Что НЕЛЬЗЯ делать:

### В коде:
- ❌ Убирать транзакции из создания заказов
- ❌ Отключать CSRF защиту
- ❌ Увеличивать лимиты заказов выше 10/минуту
- ❌ Использовать innerHTML без санитизации
- ❌ Сохранять пароли в открытом виде
- ❌ Добавлять fallback для `JWT_SECRET` — сервер должен падать без переменной

### В настройках:
- ❌ Использовать слабый `JWT_SECRET` (< 16 символов)
- ❌ Отключать rate limiting
- ❌ Разрешать CORS для всех доменов в продакшене
- ❌ Увеличивать лимит размера запросов выше 5MB

## 🛠 Частые проблемы и решения

### "Заказ не создается"
1. Проверить остатки товара в БД (админка)
2. Убедиться что транзакции работают (см. `backend/config/database.js`)
3. Проверить логи сервера

### "Админка не работает"
1. Проверить CSRF токены в браузере (F12 → Network)
2. Убедиться что JWT токен не истёк
3. Проверить rate limiting (429 ошибки)

### "База данных не создаётся"
1. Удалите `data/biolab.db`
2. Запустите `node backend/migrations/migrator.js` вручную
3. Перезапустите сервер

### "Email не отправляется"
1. Проверить App Password в настройках email
2. Убедиться что 2FA включена на аккаунте
3. Проверить `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` в `.env`

## 📋 Чеклист перед деплоем

- [ ] `JWT_SECRET` изменён на случайную строку >= 16 символов
- [ ] `ALLOWED_ORIGINS` настроен для production-домена
- [ ] Email-настройки проверены
- [ ] SQLite бэкап сделан (скопировать `data/biolab.db`)
- [ ] Создан production-админ (не demo-аккаунт)
- [ ] Протестированы все функции
- [ ] `npm audit` — нет критических уязвимостей

### Чеклист миграции с MongoDB → SQLite (выполнено ✅)
- [x] MongoDB connection string удалён
- [x] `backend/config/database.js` переписан на better-sqlite3
- [x] Все контроллеры адаптированы
- [x] Транзакции SQLite реализованы
- [x] Система миграций БД создана
- [x] `npm install` выполнен
- [x] S3-хранилище реализовано
- [x] Telegram-уведомления добавлены

## 📊 Структура базы данных (SQLite + better-sqlite3)

```
users        — админы (username, password bcrypt hash, role, tokenVersion)
categories   — категории товаров (name, slug, description, imageUrl)
products     — товары (title, description, price, stock, category, images, modelUrl, size, salePrice)
orders       — заказы (orderCode, customerName, customerPhone, customerEmail, items JSON, totalPrice, status, qrCode)
settings     — настройки магазина (email, phone, address, socials JSON, aboutText)
_migrations  — отслеживание применённых миграций (id, name, applied_at)
```

## 🔄 Система миграций БД

Миграции находятся в `backend/migrations/` и выполняются автоматически при старте сервера.

**Структура миграции:**
```javascript
// backend/migrations/003_new_feature.js
module.exports = {
  id: '003',
  name: '003_new_feature',
  up: (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS new_table (...)`);
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS new_table`);
  }
};
```

**Запуск миграций вручную:**
```bash
node backend/migrations/migrator.js
```

**Если БД не создаётся:**
```bash
# Удалите старую БД — миграции применятся заново
rm data/biolab.db
npm start
```

**Откат миграции (для разработки):**
```bash
node backend/migrations/migrator.js --rollback=001
```

## 🔄 Регулярное обслуживание

### Еженедельно:
- Проверять логи на подозрительную активность
- Мониторить использование rate limiting
- Проверять размер `data/biolab.db`

### Ежемесячно:
- Обновлять npm зависимости (`npm audit fix`)
- Делать бэкап SQLite-базы
- Анализировать статистику заказов

### При обновлениях:
- Тестировать на локальном окружении
- Проверять все security middleware
- Убеждаться что транзакции работают

## 🗄️ SQL-операции (через SQLiteDB класс)

```javascript
const db = require('../config/database');

// Без транзакции
const user = db.findOne('users', { username: 'admin' });
db.insert('products', { _id: 'prod_1', title: 'Помидор', price: 100 });
db.updateOne('products', { _id: 'prod_1' }, { stock: 50 });
db.deleteOne('orders', { _id: 'order_123' });

// С транзакцией (защита от race condition)
db.beginTransaction();
try {
  // чтение, проверка, запись — всё внутри
  db.commit();
} catch (e) {
  db.rollback();
}
```

## 💾 Хранилище файлов (Storage)

**Файл:** `backend/services/storage.js`

**Два режима:**
- `STORAGE_TYPE=local` — файлы хранятся в `uploads/` (по умолчанию, для разработки)
- `STORAGE_TYPE=s3` — файлы в S3-совместимом хранилище

**API хранилища:**
```javascript
const storage = require('./services/storage');

// Загрузка файла
const result = await storage.upload(fileBuffer, 'products', 'image.jpg');

// Получение URL
const url = storage.getUrl('products/image.jpg');

// Удаление файла
await storage.delete('products/image.jpg');
```

**S3-провайдеры:** AWS S3, Selectel, Cloudflare R2, MinIO

## 📱 Telegram-уведомления

**Файл:** `backend/services/notifications.js`

При создании заказа отправляет уведомление админу в Telegram.

**Настройка:**
1. Создать бота через @BotFather → получить BOT_TOKEN
2. Узнать CHAT_ID через @userinfobot
3. Добавить в `.env`:
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...
```

**Использование в коде:**
```javascript
const { sendOrderNotification } = require('./services/notifications');

// При создании заказа
await sendOrderNotification(order);
```

## 🧪 Запуск тестов

**Файлы:** `backend/tests/*.test.js` (24 теста)

**Команды:**
```bash
npm test           # Все тесты один раз
npm run test:watch # Автоперезапуск при изменениях
```

**Покрытие:** API эндпоинты, валидация, обработка ошибок

## 📞 Контакты для экстренных случаев

**Хостинг:** Render.com support
**Node.js:** nodejs.org/community
**SQLite:** sqlite.org

---

**Помни:** Безопасность важнее скорости разработки! 🔒
