# Biolab - Интернет-магазин школьной биолаборатории

Система заказов растений из теплицы с QR-кодами для выдачи товара.

## Технологии

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT авторизация
- QR-коды для заказов
- Email уведомления

**Frontend:**
- Vanilla JavaScript
- Fancybox (галерея)
- Model Viewer (3D модели)

## Установка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите:
- `MONGODB_URI` - строка подключения к MongoDB
- `JWT_SECRET` - секретный ключ для JWT (любая случайная строка)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` - настройки SMTP для отправки email

### 3. Запуск MongoDB

Убедитесь, что MongoDB запущена локально или используйте MongoDB Atlas (облачная БД).

**Локальный запуск MongoDB:**
```bash
mongod
```

**MongoDB Atlas (бесплатно):**
1. Зарегистрируйтесь на https://www.mongodb.com/cloud/atlas
2. Создайте кластер
3. Получите строку подключения и вставьте в `.env`

### 4. Запуск сервера

**Режим разработки (с автоперезагрузкой):**
```bash
npm run dev
```

**Продакшн:**
```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## API Endpoints

### Авторизация

**POST** `/api/auth/register` - Регистрация админа
```json
{
  "username": "admin",
  "password": "password123"
}
```

**POST** `/api/auth/login` - Вход админа
```json
{
  "username": "admin",
  "password": "password123"
}
```

**GET** `/api/auth/verify` - Проверка токена (требует Authorization header)

### Товары

**GET** `/api/products` - Получить все товары
- Query параметры: `?category=Деревья&sort=price_asc`

**GET** `/api/products/:id` - Получить товар по ID

**POST** `/api/products` - Создать товар (требует авторизации)
- Content-Type: `multipart/form-data`
- Поля: `title`, `description`, `price`, `category`, `stock`, `size`, `image` (файл)

**PUT** `/api/products/:id` - Обновить товар (требует авторизации)

**DELETE** `/api/products/:id` - Удалить товар (требует авторизации)

### Заказы

**POST** `/api/orders` - Создать заказ
```json
{
  "customerName": "Иван Иванов",
  "customerPhone": "+79001234567",
  "customerEmail": "ivan@example.com",
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "quantity": 2
    }
  ]
}
```

**GET** `/api/orders` - Получить все заказы (требует авторизации)
- Query параметры: `?status=pending`

**GET** `/api/orders/number/:orderNumber` - Получить заказ по номеру

**PUT** `/api/orders/:orderNumber/status` - Обновить статус заказа (требует авторизации)
```json
{
  "status": "completed"
}
```

**POST** `/api/orders/:orderNumber/cancel` - Отменить заказ (требует авторизации)

### Категории

**GET** `/api/categories` - Получить все категории

**POST** `/api/categories` - Создать категорию (требует авторизации)
```json
{
  "name": "Деревья",
  "slug": "trees"
}
```

**DELETE** `/api/categories/:id` - Удалить категорию (требует авторизации)

## Первоначальная настройка

### 1. Создание первого админа

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_secure_password"}'
```

### 2. Создание категорий

```bash
# Получите токен после входа
TOKEN="your_jwt_token"

curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Деревья","slug":"trees"}'

curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Кустарники","slug":"shrubs"}'
```

## Структура проекта

```
biolab/
├── backend/
│   ├── models/          # Mongoose модели
│   ├── routes/          # Express маршруты
│   ├── controllers/     # Контроллеры
│   ├── middleware/      # Middleware (авторизация)
│   ├── config/          # Конфигурация (БД)
│   ├── utils/           # Утилиты (QR, email)
│   └── server.js        # Главный файл сервера
├── admin/               # Админка (в разработке)
├── uploads/             # Загруженные изображения
├── assets/              # Фронтенд ресурсы
├── images/              # Статические изображения
├── index.html           # Главная страница
├── package.json
├── .env                 # Переменные окружения
└── README.md
```

## Деплой

### Render.com (бесплатно)

1. Создайте аккаунт на https://render.com
2. Создайте Web Service из GitHub репозитория
3. Настройки:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables: добавьте все из `.env`
4. Создайте MongoDB Atlas кластер и укажите строку подключения

### Хостинг школы

Инструкции будут добавлены позже после уточнения требований хостинга.

## Флоу заказа

1. Покупатель выбирает товар на сайте
2. Заполняет форму заказа (имя, телефон, email)
3. Система создает заказ, генерирует QR-код
4. QR-код отправляется на email и показывается на экране
5. Покупатель приходит в теплицу с QR-кодом
6. Админ сканирует QR → видит детали заказа
7. Админ выдает товар → отмечает заказ как "Выдан"
8. Оплата на месте (наличные/перевод)

## Разработка

- Используйте `npm run dev` для автоперезагрузки при изменениях
- Логи сервера выводятся в консоль
- Загруженные изображения сохраняются в `uploads/`
- Доступ к изображениям: `http://localhost:3000/uploads/filename.jpg`

## TODO

- [ ] Создать админку (HTML/CSS/JS)
- [ ] Добавить сканер QR-кодов в админке
- [ ] Доработать фронтенд (форма заказа, фильтры)
- [ ] Добавить корзину (опционально)
- [ ] Тестирование
- [ ] Деплой

## Контакты

**Email:** almetevskbiolab@gmail.com

---

**Разработчик:** Школьник на летней подработке  
**Для:** Школьная биолаборатория  
**Дата:** Май 2026
