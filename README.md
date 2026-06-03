# 🌱 Biolab - Интернет-магазин растений

Современный интернет-магазин для школьной биолаборатории с системой заказов через QR-коды.

## 🚀 Быстрый старт

```bash
# 1. Установка зависимостей
npm install

# 2. Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл

# 3. Запуск
npm start
```

**Админка:** `/admin` — логин и пароль создаются автоматически при первом запуске (см. лог сервера)

## 📋 Возможности

### Для покупателей:
- 🛒 Просмотр каталога растений с фото и 3D-моделями
- 📱 Оформление заказа через форму
- 📧 Получение QR-кода на email
- 🏪 Выдача товара в теплице по QR-коду

### Для админов:
- 📦 Управление товарами (добавление, редактирование, удаление)
- 📋 Просмотр и обработка заказов
- 📊 Статистика продаж
- 📱 Сканирование QR-кодов
- 💾 Автоматическое управление остатками

## 🛠 Технологии

**Backend:** Node.js, Express, SQLite (better-sqlite3), JWT  
**Frontend:** Vanilla JS, Fancybox, Model Viewer  
**Безопасность:** Helmet, Rate Limiting, CORS, XSS Protection

## 🔧 Настройка

### Переменные окружения (.env):
```env
# JWT (обязательно, минимум 16 символов)
JWT_SECRET=your-super-secret-key-at-least-16-chars
JWT_EXPIRES_IN=24h

# Email (для уведомлений, опционально)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_ENABLED=true

# Безопасность
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

### Первый запуск:
При первом запуске автоматически создаётся админ:
- **Логин:** `admin`
- **Пароль:** смотрите в логе сервера после первого запуска

## 🌐 Деплой

### Render.com (бесплатно):

1. **Создайте GitHub репозиторий** с кодом проекта

2. **На Render.com:**
   - New → Web Service
   - Подключите GitHub репозиторий
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

3. **Переменные окружения в Render:**
```
NODE_ENV=production
JWT_SECRET=<сгенерируйте случайную строку 32+ символов>
ALLOWED_ORIGINS=https://your-service.onrender.com
PORT=3000
```

4. **Деплой:**
   - Нажмите "Create Web Service"
   - Подождите 2-3 минуты
   - Сайт готов!

### Railway.app:
- Similar steps, use `npm start` as start command

### VPS / Локальный сервер:
```bash
npm install
npm start
# Сервер запустится на порту 3000
```

## 📱 Использование

### Покупатель:
1. Заходит на сайт → выбирает товар → "Заказать"
2. Заполняет форму (имя, телефон, email)
3. Получает QR-код на экран
4. Приходит в теплицу → показывает QR
5. Оплачивает на месте

### Админ:
1. Вход в `/admin` — логин и пароль из лога сервера
2. Управляет товарами и заказами
3. Сканирует QR-код → отмечает заказ выданным

## 🔒 Безопасность

- ✅ Защита от XSS атак
- ✅ Rate limiting (защита от спама)
- ✅ CORS настройка
- ✅ Валидация всех входных данных
- ✅ Хеширование паролей (bcrypt)
- ✅ JWT токены с истечением
- ✅ Защита от SQL инъекций

## 📊 API Endpoints

### Публичные:
```
GET  /api/health          # Проверка работы
GET  /api/products        # Список товаров
GET  /api/categories       # Категории
GET  /api/settings         # Настройки магазина
POST /api/orders           # Создать заказ
GET  /api/orders/code/:code  # Найти заказ по коду
GET  /api/orders/phone/:phone # Найти заказы по телефону
```

### Админ (требует авторизацию):
```
POST /api/auth/login       # Вход админа
POST /api/auth/logout      # Выход
GET  /api/auth/verify      # Проверка токена

GET    /api/products       # Список товаров
POST   /api/products       # Добавить товар
PUT    /api/products/:id   # Редактировать товар
DELETE /api/products/:id   # Удалить товар

POST /api/categories       # Добавить категорию
DELETE /api/categories/:id # Удалить категорию

GET    /api/orders          # Все заказы
GET    /api/orders/admin/code/:code # Детали заказа (админ)
POST   /api/orders/:code/complete  # Отметить выданным
POST   /api/orders/:code/cancel    # Отменить заказ

GET  /api/settings         # Получить настройки
PUT  /api/settings         # Сохранить настройки
```

## 📱 PWA — Progressive Web App

Biolab поддерживает установку на устройство как приложение:
- Офлайн-режим (просмотр ранее загруженных страниц)
- Иконки для домашнего экрана (192x192 и 512x512)
- Web App Manifest

**Файлы:**
- `public/manifest.json` — манифест PWA
- `public/sw.js` — service worker
- `public/offline.html` — страница офлайн
- `public/icon-192.svg`, `public/icon-512.svg` — иконки

## 🤖 Telegram-уведомления

При создании нового заказа админ получает уведомление в Telegram:
- Новый заказ с деталями (имя клиента, состав, сумма)
- Быстрое уведомление без захода в админку

**Настройка:**
1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Получите `BOT_TOKEN`
3. Узнайте ваш `CHAT_ID` через [@userinfobot](https://t.me/userinfobot)
4. Добавьте в `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_chat_id
```

## 💾 S3-хранилище файлов

По умолчанию файлы хранятся локально (`uploads/`). Для продакшена можно использовать S3:
- `STORAGE_TYPE=local` — локальное хранение (по умолчанию)
- `STORAGE_TYPE=s3` — S3-совместимое хранилище

**S3-провайдеры:** AWS S3, Selectel, Cloudflare R2, MinIO

## 🧪 Запуск тестов

```bash
# Все тесты
npm test

# Watch mode (автоперезапуск при изменениях)
npm run test:watch
```

**24 теста** покрывают:
- API эндпоинты (products, orders, auth)
- Валидацию данных
- Обработку ошибок

Тесты: `backend/tests/*.test.js`

## 🐳 Docker

```bash
# Сборка
docker build -t biolab .

# Запуск
docker run -p 3000:3000 --env-file .env biolab
```

**Dockerfile** уже есть в проекте.

| npm run sitemap  | Генерация sitemap.xml                    |
| npm run test     | Запуск Jest-тестов (24 теста)            |
| npm run test:watch | Тесты в watch-режиме                   |

## 📁 Структура проекта

```
biolab/
├── backend/
│   ├── config/
│   │   └── database.js    # SQLite Database Layer (better-sqlite3)
│   ├── controllers/       # Логика API
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── categoryController.js
│   │   └── settingsController.js
│   ├── middleware/        # Auth, security
│   ├── migrations/       # Миграции БД
│   │   ├── migrator.js   # Мигратор
│   │   ├── 001_initial_schema.js
│   │   └── 002_seed_categories.js
│   ├── routes/           # API routes
│   ├── services/         # Хранилище, уведомления
│   │   ├── storage.js    # S3/Local storage
│   │   └── notifications.js # Telegram
│   ├── tests/            # Jest-тесты
│   ├── utils/            # QR generator, email, logger
│   │   └── logger.js     # Winston logger
│   └── server.js         # Главный файл
├── data/                  # SQLite база данных (создаётся автоматически)
├── public/                # Статические файлы, PWA
│   ├── manifest.json     # PWA манифест
│   ├── sw.js             # Service Worker
│   └── offline.html      # Офлайн-страница
├── assets/
│   └── css/
│       └── theme.css     # CSS-тема
├── scripts/
│   └── generate-sitemap.js
├── .env                   # Переменные окружения
└── package.json
```

## 🐛 Устранение неполадок

**Сервер не запускается:**
- Проверьте .env файл (JWT_SECRET должен быть ≥16 символов)
- Убедитесь что порт 3000 свободен

**Админка не работает:**
- Проверьте что JWT_SECRET установлен в .env
- Логин и пароль указаны в логе сервера при первом запуске

**Ошибка базы данных:**
- Удалите `data/biolab.db` и перезапустите — база создастся заново (миграции применятся автоматически)

**Sitemap устарел:**
- Запустите `npm run sitemap` для генерации свежего sitemap.xml

**Email не отправляется:**
- Проверьте EMAIL_* настройки в .env
- Для Gmail используйте App Password (не обычный пароль)

---

**Статус:** ✅ Готов к продакшену
**Версия:** 1.3.0
**База данных:** SQLite (better-sqlite3)
**Последнее обновление:** 03.06.2026