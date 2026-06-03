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

**Backend:** Node.js, Express, SQLite (sql.js), JWT  
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

## 📁 Структура проекта

```
biolab/
├── backend/
│   ├── config/
│   │   └── database.js    # SQLite Database Layer
│   ├── controllers/       # Логика API
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── categoryController.js
│   │   └── settingsController.js
│   ├── middleware/        # Auth, security
│   ├── routes/           # API routes
│   ├── utils/            # QR generator, email sender
│   └── server.js         # Главный файл
├── data/                  # SQLite база данных (создаётся автоматически)
├── public/                # Статические файлы (HTML, CSS, JS)
├── uploads/               # Загруженные изображения
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
- Удалите `data/biolab.db` и перезапустите — база создастся заново

**Email не отправляется:**
- Проверьте EMAIL_* настройки в .env
- Для Gmail используйте App Password (не обычный пароль)

---

**Статус:** ✅ Готов к продакшену  
**Версия:** 1.2.0  
**База данных:** SQLite (sql.js)
**Последнее обновление:** 31.05.2026