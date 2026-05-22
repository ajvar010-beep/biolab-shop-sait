# 🚀 Быстрый деплой Biolab на Render.com

## Шаг 1: GitHub репозиторий
1. Зайдите на https://github.com
2. Создайте новый репозиторий с именем `biolab`
3. Скопируйте URL репозитория (например: `https://github.com/username/biolab.git`)

## Шаг 2: Загрузка кода
Выполните в терминале:
```bash
cd C:\bat\biolab-main
git remote add origin https://github.com/ВАШ_USERNAME/biolab.git
git branch -M main
git push -u origin main
```

## Шаг 3: MongoDB Atlas (5 минут)
1. Зарегистрируйтесь на https://cloud.mongodb.com
2. Создайте бесплатный кластер (M0 Sandbox)
3. Database Access → Add New Database User (запомните username/password)
4. Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)
5. Clusters → Connect → Connect your application → скопируйте строку подключения

## Шаг 4: Gmail App Password (3 минуты)
1. Включите 2FA в Google аккаунте
2. Google Account → Security → App passwords
3. Создайте пароль для "Mail" → скопируйте 16-символьный код

## Шаг 5: Render.com деплой (10 минут)
1. Зарегистрируйтесь на https://render.com
2. New + → Web Service → подключите GitHub репозиторий
3. Настройки:
   - **Name**: biolab
   - **Region**: Frankfurt (EU Central)
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. Environment Variables (добавьте все):
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/biolab?retryWrites=true&w=majority
   JWT_SECRET=очень_длинный_случайный_ключ_минимум_32_символа
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=ваш_email@gmail.com
   EMAIL_PASS=ваш_16_символьный_app_password
   PORT=3000
   NODE_ENV=production
   FRONTEND_URL=https://ваше-приложение.onrender.com
   ```

5. Deploy → дождитесь завершения (5-10 минут)

## Шаг 6: Создание админа
После успешного деплоя:
1. Откройте https://ваше-приложение.onrender.com/admin/login.html
2. Зарегистрируйте первого админа через API или используйте скрипт

## 🎉 Готово!
- Сайт: https://ваше-приложение.onrender.com
- Админка: https://ваше-приложение.onrender.com/admin

## Первый админ
Username: admin
Password: admin123 (смените после входа!)

---
**Время деплоя: ~30 минут**
**Стоимость: Бесплатно**