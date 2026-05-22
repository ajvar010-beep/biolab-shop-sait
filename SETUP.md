# Инструкция по запуску Biolab

## Быстрый старт

### 1. Установка зависимостей

```powershell
cd C:\bat\biolab-main
npm install
```

### 2. Настройка окружения

Создайте файл `.env` (уже создан, проверьте настройки):

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/biolab
JWT_SECRET=your-secret-key-change-in-production

# Email настройки (опционально)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=Biolab <noreply@biolab.com>
```

### 3. Запуск MongoDB

**Вариант А: Локально**
```powershell
mongod
```

**Вариант Б: MongoDB Atlas (рекомендуется)**
1. Зарегистрируйтесь на https://www.mongodb.com/cloud/atlas
2. Создайте бесплатный кластер
3. Получите строку подключения
4. Замените `MONGODB_URI` в `.env`

### 4. Запуск сервера

```powershell
npm run dev
```

Сервер запустится на http://localhost:3000

### 5. Создание первого администратора

Откройте новый терминал PowerShell:

```powershell
# Регистрация админа
$body = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" -Method POST -Body $body -ContentType "application/json"
```

### 6. Создание категорий

```powershell
# Получить токен
$loginBody = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
$token = $loginResponse.token

# Создать категории
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$category1 = @{
    name = "Деревья"
    slug = "trees"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method POST -Body $category1 -Headers $headers

$category2 = @{
    name = "Кустарники"
    slug = "shrubs"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method POST -Body $category2 -Headers $headers
```

### 7. Вход в админку

Откройте в браузере:
```
http://localhost:3000/admin/login.html
```

Логин: `admin`  
Пароль: `admin123`

## Структура проекта

```
biolab-main/
├── backend/              # Backend API
│   ├── models/          # MongoDB модели
│   ├── routes/          # API маршруты
│   ├── controllers/     # Контроллеры
│   ├── middleware/      # Middleware (auth)
│   ├── config/          # Конфигурация БД
│   ├── utils/           # Утилиты (QR, email)
│   └── server.js        # Главный файл сервера
├── admin/               # Админ-панель
│   ├── css/
│   │   └── admin.css    # Стили админки
│   ├── js/
│   │   ├── auth.js      # Авторизация
│   │   ├── products.js  # Управление товарами
│   │   ├── orders.js    # Управление заказами
│   │   └── categories.js # Управление категориями
│   ├── login.html       # Страница входа
│   ├── index.html       # Главная панель
│   ├── products.html    # Товары
│   ├── orders.html      # Заказы
│   └── categories.html  # Категории
├── uploads/             # Загруженные изображения
├── index.html           # Фронтенд сайта
├── images/              # Изображения сайта
├── assets/              # CSS/JS фронтенда
├── package.json
├── .env
└── README.md
```

## Доступные страницы

- **Фронтенд:** http://localhost:3000/
- **Админка:** http://localhost:3000/admin/login.html
- **API:** http://localhost:3000/api/

## Возможности админки

### 1. Главная панель (index.html)
- Статистика: всего товаров, заказов, ожидающих, выполненных
- Последние заказы
- Товары с низким остатком

### 2. Управление товарами (products.html)
- Просмотр всех товаров
- Добавление нового товара
- Редактирование товара
- Удаление товара
- Загрузка изображений
- Фильтрация по категориям
- Поиск по названию

### 3. Управление заказами (orders.html)
- Просмотр всех заказов
- Детали заказа с QR-кодом
- Выдача заказа (изменение статуса)
- Отмена заказа
- Сканирование QR (ввод номера заказа)
- Фильтрация по статусу
- Поиск по номеру/имени
- Автообновление каждые 30 секунд

### 4. Управление категориями (categories.html)
- Просмотр категорий
- Добавление категории
- Удаление категории
- Автогенерация slug из названия

## Тестирование

### Тест 1: Создание товара через админку
1. Войдите в админку
2. Перейдите в "Товары"
3. Нажмите "Добавить товар"
4. Заполните форму
5. Загрузите изображение
6. Сохраните

### Тест 2: Проверка API
```powershell
# Получить все товары
Invoke-RestMethod -Uri "http://localhost:3000/api/products"

# Получить все категории
Invoke-RestMethod -Uri "http://localhost:3000/api/categories"
```

### Тест 3: Создание заказа (когда фронтенд будет готов)
1. Выберите товар на сайте
2. Нажмите "Заказать"
3. Заполните форму
4. Получите QR-код
5. Проверьте заказ в админке

## Следующие шаги

1. ✅ Backend готов
2. ✅ Админка готова
3. ⏳ Доработать фронтенд:
   - Загрузка товаров из API
   - Форма заказа
   - Отображение QR-кода
4. ⏳ Тестирование
5. ⏳ Деплой

## Проблемы и решения

**MongoDB не запускается:**
- Используйте MongoDB Atlas (бесплатно)

**Порт 3000 занят:**
- Измените `PORT` в `.env`

**Ошибки при установке:**
- Убедитесь что Node.js 18+
- Попробуйте `npm install --legacy-peer-deps`

**Email не отправляется:**
- Проверьте настройки в `.env`
- Для Gmail создайте App Password

## Полезные команды

```powershell
# Запуск в режиме разработки
npm run dev

# Запуск в production
npm start

# Проверка версии Node.js
node --version

# Очистка node_modules
Remove-Item -Recurse -Force node_modules
npm install
```

---

**Дата:** 2026-05-17  
**Версия:** 1.0  
**Статус:** Backend и админка готовы к тестированию
