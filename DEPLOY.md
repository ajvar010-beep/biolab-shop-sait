# Инструкция по деплою Biolab

## Подготовка к деплою

### 1. Создание аккаунтов

#### MongoDB Atlas (База данных)
1. Зарегистрируйтесь на https://www.mongodb.com/cloud/atlas/register
2. Создайте бесплатный кластер (M0 Sandbox)
3. Создайте пользователя базы данных:
   - Database Access → Add New Database User
   - Выберите Password authentication
   - Сохраните username и password
4. Настройте доступ:
   - Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)
5. Получите строку подключения:
   - Clusters → Connect → Connect your application
   - Скопируйте строку вида: `mongodb+srv://username:password@cluster.mongodb.net/biolab`

#### Render.com (Хостинг)
1. Зарегистрируйтесь на https://render.com/
2. Подключите GitHub аккаунт
3. Создайте репозиторий на GitHub и загрузите туда код проекта

### 2. Настройка переменных окружения

Создайте файл `.env.production` со следующими переменными:

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/biolab?retryWrites=true&w=majority

# JWT Secret (сгенерируйте случайную строку)
JWT_SECRET=ваш_очень_длинный_и_случайный_секретный_ключ_минимум_32_символа

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=ваш_email@gmail.com
EMAIL_PASS=ваш_app_password

# Server
PORT=3000
NODE_ENV=production

# Frontend URL (будет URL вашего Render приложения)
FRONTEND_URL=https://ваше-приложение.onrender.com
```

### 3. Настройка Gmail для отправки email

1. Включите двухфакторную аутентификацию в Google аккаунте
2. Создайте App Password:
   - Google Account → Security → 2-Step Verification → App passwords
   - Выберите "Mail" и "Other (Custom name)"
   - Скопируйте сгенерированный пароль (16 символов)
   - Используйте его в `EMAIL_PASS`

## Деплой на Render.com

### Шаг 1: Подготовка репозитория

1. Убедитесь, что `.gitignore` содержит:
```
node_modules/
.env
.env.local
.env.production
uploads/*
!uploads/.gitkeep
```

2. Создайте файл `uploads/.gitkeep` (пустой файл для сохранения папки в git)

3. Закоммитьте и запушьте код на GitHub:
```bash
git add .
git commit -m "Подготовка к деплою"
git push origin main
```

### Шаг 2: Создание Web Service на Render

1. Войдите на https://dashboard.render.com/
2. Нажмите "New +" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройте сервис:
   - **Name**: biolab (или любое другое имя)
   - **Region**: Frankfurt (EU Central) - ближайший к России
   - **Branch**: main
   - **Root Directory**: оставьте пустым
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Добавьте переменные окружения (Environment Variables):
   - Нажмите "Advanced" → "Add Environment Variable"
   - Добавьте все переменные из `.env.production`
   - **ВАЖНО**: `FRONTEND_URL` должен быть URL вашего Render приложения

6. Нажмите "Create Web Service"

### Шаг 3: Ожидание деплоя

- Render автоматически установит зависимости и запустит приложение
- Процесс займет 5-10 минут
- Следите за логами в реальном времени
- После успешного деплоя вы получите URL вида: `https://biolab.onrender.com`

### Шаг 4: Обновление FRONTEND_URL

1. Скопируйте URL вашего приложения
2. В настройках Render → Environment → обновите `FRONTEND_URL`
3. Сохраните изменения (приложение автоматически перезапустится)

### Шаг 5: Создание первого админа

После успешного деплоя создайте первого администратора:

```bash
curl -X POST https://ваше-приложение.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "ваш_надежный_пароль"
  }'
```

Или используйте Postman/Insomnia для отправки POST запроса.

## Проверка работоспособности

1. **Фронтенд**: https://ваше-приложение.onrender.com/
   - Должны загрузиться товары (если они есть в БД)
   - Поиск должен работать

2. **Админка**: https://ваше-приложение.onrender.com/admin/login.html
   - Войдите с созданными credentials
   - Добавьте несколько товаров
   - Проверьте категории

3. **Создание заказа**:
   - Откройте фронтенд
   - Нажмите "Заказать" на товаре
   - Заполните форму
   - Проверьте, что QR-код отображается
   - Проверьте email (если настроен)

## Обновление приложения

После внесения изменений в код:

```bash
git add .
git commit -m "Описание изменений"
git push origin main
```

Render автоматически обнаружит изменения и выполнит повторный деплой.

## Важные замечания

### Бесплатный план Render.com
- Приложение "засыпает" после 15 минут неактивности
- Первый запрос после "сна" займет 30-60 секунд
- Ограничение: 750 часов работы в месяц (достаточно для одного приложения)

### Решение проблемы "засыпания"
Используйте бесплатный сервис для пинга (например, UptimeRobot):
1. Зарегистрируйтесь на https://uptimerobot.com/
2. Создайте монитор для вашего URL
3. Интервал проверки: 5 минут
4. Это будет "будить" приложение регулярно

### Загрузка изображений
- На бесплатном плане Render файлы не сохраняются между деплоями
- Для продакшена рекомендуется использовать:
  - Cloudinary (бесплатно до 25GB)
  - AWS S3
  - Или хранить изображения в репозитории (не рекомендуется)

### MongoDB Atlas
- Бесплатный план: 512MB хранилища
- Достаточно для ~10,000 товаров и заказов
- Автоматические бэкапы недоступны на бесплатном плане

## Миграция на школьный хостинг

Когда будете переносить на хостинг школы:

1. Экспортируйте данные из MongoDB Atlas:
```bash
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/biolab"
```

2. Импортируйте на новый сервер:
```bash
mongorestore --uri="mongodb://localhost:27017/biolab" dump/biolab
```

3. Обновите переменные окружения на новом сервере

4. Настройте nginx или Apache для проксирования запросов

## Поддержка и отладка

### Просмотр логов на Render
- Dashboard → Ваш сервис → Logs
- Логи обновляются в реальном времени

### Частые проблемы

**Ошибка подключения к MongoDB**
- Проверьте правильность строки подключения
- Убедитесь, что IP адрес разрешен в Network Access
- Проверьте username и password

**Email не отправляются**
- Проверьте App Password в Gmail
- Убедитесь, что двухфакторная аутентификация включена
- Проверьте логи на наличие ошибок SMTP

**Приложение не запускается**
- Проверьте логи на Render
- Убедитесь, что все зависимости установлены
- Проверьте правильность переменных окружения

## Контакты

По вопросам работы сайта: almetevskbiolab@gmail.com
