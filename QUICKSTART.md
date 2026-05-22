# Быстрый старт - Biolab Backend

## Что уже готово ✅

Backend полностью реализован:
- ✅ Структура папок (models, routes, controllers, middleware, config, utils)
- ✅ MongoDB модели (Admin, Product, Order, Category)
- ✅ API endpoints (auth, products, orders, categories)
- ✅ JWT авторизация
- ✅ Генерация QR-кодов
- ✅ Email уведомления
- ✅ Загрузка изображений (multer)
- ✅ package.json с зависимостями

## Следующие шаги

### 1. Установка и запуск (5 минут)

```bash
# Установить зависимости
npm install

# Запустить MongoDB (если локально)
mongod

# Запустить сервер
npm run dev
```

### 2. Создать первого админа

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

### 3. Войти и получить токен

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Сохраните полученный `token` - он понадобится для всех админских операций.

### 4. Создать категории

```bash
# Замените YOUR_TOKEN на токен из шага 3
curl -X POST http://localhost:3000/api/categories -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d "{\"name\":\"Деревья\",\"slug\":\"trees\"}"

curl -X POST http://localhost:3000/api/categories -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d "{\"name\":\"Кустарники\",\"slug\":\"shrubs\"}"
```

### 5. Добавить тестовый товар

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Яблоня" \
  -F "description=Молодая яблоня, 2 года" \
  -F "price=500" \
  -F "category=Деревья" \
  -F "stock=10" \
  -F "size=normal"
```

### 6. Проверить товары

```bash
curl http://localhost:3000/api/products
```

## Что делать дальше

### Вариант А: Тестирование API
Используйте Postman или Insomnia для тестирования всех endpoints из README.md

### Вариант Б: Создать админку
Следующий этап - создать веб-интерфейс для админов:
- Страница входа
- Управление товарами
- Просмотр заказов
- Сканер QR-кодов

### Вариант В: Доработать фронтенд
Интегрировать существующий сайт с backend:
- Загрузка товаров из API вместо Google Sheets
- Форма заказа
- Отображение QR-кода после заказа

## Настройка email (опционально)

Для отправки QR-кодов на email отредактируйте `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Для Gmail нужно создать App Password: https://myaccount.google.com/apppasswords

## Проблемы?

**MongoDB не запускается:**
- Используйте MongoDB Atlas (бесплатно): https://www.mongodb.com/cloud/atlas
- Замените `MONGODB_URI` в `.env` на строку подключения Atlas

**Порт 3000 занят:**
- Измените `PORT=3001` в `.env`

**Ошибки при установке:**
- Убедитесь что установлен Node.js 18+ (`node --version`)
- Попробуйте `npm install --legacy-peer-deps`

## Структура API

```
GET    /api/products              - Все товары
GET    /api/products/:id          - Товар по ID
POST   /api/products              - Создать товар (auth)
PUT    /api/products/:id          - Обновить товар (auth)
DELETE /api/products/:id          - Удалить товар (auth)

POST   /api/orders                - Создать заказ
GET    /api/orders                - Все заказы (auth)
GET    /api/orders/number/:num    - Заказ по номеру
PUT    /api/orders/:num/status    - Обновить статус (auth)
POST   /api/orders/:num/cancel    - Отменить заказ (auth)

POST   /api/auth/register         - Регистрация админа
POST   /api/auth/login            - Вход админа
GET    /api/auth/verify           - Проверка токена (auth)

GET    /api/categories            - Все категории
POST   /api/categories            - Создать категорию (auth)
DELETE /api/categories/:id        - Удалить категорию (auth)
```

---

**Дата:** 2026-05-17  
**Статус:** Backend готов к тестированию
