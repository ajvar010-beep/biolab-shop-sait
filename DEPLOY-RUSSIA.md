# Инструкция по деплою для России

## ⚠️ ВАЖНО: Доступность из России

Этот проект адаптирован для работы в России. Все внешние зависимости используют jsDelivr CDN, который работает в РФ.

## Рекомендуемые хостинги для России

### Вариант 1: Timeweb (Рекомендуется)
**Плюсы:**
- Российская компания
- Бесплатный тестовый период 30 дней
- Поддержка Node.js
- Встроенная MongoDB
- Техподдержка на русском

**Стоимость:** от 150₽/месяц

**Инструкция:**
1. Зарегистрируйтесь на https://timeweb.com/
2. Создайте VPS (Ubuntu 22.04)
3. Подключитесь по SSH
4. Установите Node.js, MongoDB, Git
5. Склонируйте репозиторий
6. Настройте переменные окружения
7. Запустите приложение через PM2

### Вариант 2: Beget
**Плюсы:**
- Российская компания
- Дешевый хостинг
- Поддержка Node.js

**Минусы:**
- Нет встроенной MongoDB (нужно устанавливать отдельно)

**Стоимость:** от 100₽/месяц

### Вариант 3: REG.RU
**Плюсы:**
- Крупная российская компания
- VPS с полным контролем

**Стоимость:** от 200₽/месяц

### Вариант 4: Локальный сервер в школе
**Плюсы:**
- Полный контроль
- Бесплатно
- Быстрый доступ

**Минусы:**
- Нужен постоянно включенный компьютер
- Нужен белый IP или настройка VPN

## База данных

### Вариант 1: MongoDB на том же сервере (Рекомендуется)
Установите MongoDB прямо на VPS вместе с приложением.

**Инструкция для Ubuntu:**
```bash
# Установка MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**В .env укажите:**
```
MONGODB_URI=mongodb://localhost:27017/biolab
```

### Вариант 2: MongoDB Atlas
MongoDB Atlas работает из России, но может быть медленным.

**Инструкция:**
1. Зарегистрируйтесь на https://www.mongodb.com/cloud/atlas
2. Создайте бесплатный кластер
3. Выберите регион: Frankfurt (ближайший к России)
4. Получите строку подключения

## Пошаговая инструкция деплоя на Timeweb

### Шаг 1: Создание VPS

1. Зарегистрируйтесь на https://timeweb.com/
2. Панель управления → Серверы → Создать сервер
3. Выберите:
   - **ОС:** Ubuntu 22.04
   - **Тариф:** Минимальный (1 CPU, 1GB RAM)
   - **Локация:** Москва
4. Создайте сервер и дождитесь запуска
5. Сохраните IP адрес и пароль root

### Шаг 2: Подключение к серверу

```bash
ssh root@ваш_ip_адрес
```

### Шаг 3: Установка необходимого ПО

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установка MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org

# Запуск MongoDB
systemctl start mongod
systemctl enable mongod

# Установка Git
apt install -y git

# Установка PM2 (менеджер процессов)
npm install -g pm2
```

### Шаг 4: Загрузка проекта

```bash
# Создание директории
mkdir -p /var/www
cd /var/www

# Клонирование репозитория (замените на ваш URL)
git clone https://github.com/ajvar010-beep/biolab.git
cd biolab

# Установка зависимостей
npm install
```

### Шаг 5: Настройка переменных окружения

```bash
# Создание .env файла
nano .env
```

Вставьте следующее содержимое:

```env
# MongoDB (локальная)
MONGODB_URI=mongodb://localhost:27017/biolab

# JWT Secret (сгенерируйте случайную строку)
JWT_SECRET=ваш_очень_длинный_и_случайный_секретный_ключ_минимум_32_символа

# Email (если нужна отправка email)
EMAIL_HOST=smtp.yandex.ru
EMAIL_PORT=465
EMAIL_USER=ваш_email@yandex.ru
EMAIL_PASS=ваш_пароль_приложения

# Server
PORT=3000
NODE_ENV=production

# Frontend URL
FRONTEND_URL=http://ваш_ip_адрес:3000
```

Сохраните: `Ctrl+X`, затем `Y`, затем `Enter`

### Шаг 6: Настройка Email (Yandex вместо Gmail)

**Почему Yandex:**
- Работает в России
- Бесплатный
- Надежный

**Инструкция:**
1. Создайте почту на https://mail.yandex.ru/
2. Настройки → Безопасность → Пароли приложений
3. Создайте пароль для "Почтовая программа"
4. Используйте этот пароль в `EMAIL_PASS`

### Шаг 7: Создание первого админа

```bash
# Запуск приложения временно
node backend/server.js &

# Создание админа
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ваш_надежный_пароль"}'

# Остановка временного процесса
pkill node
```

### Шаг 8: Запуск через PM2

```bash
# Запуск приложения
pm2 start backend/server.js --name biolab

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Проверка статуса
pm2 status
```

### Шаг 9: Настройка Nginx (опционально)

Для работы на порту 80 (без :3000 в адресе):

```bash
# Установка Nginx
apt install -y nginx

# Создание конфигурации
nano /etc/nginx/sites-available/biolab
```

Вставьте:

```nginx
server {
    listen 80;
    server_name ваш_ip_адрес;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активация конфигурации
ln -s /etc/nginx/sites-available/biolab /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Шаг 10: Настройка файрвола

```bash
# Разрешить HTTP, HTTPS, SSH
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

## Проверка работоспособности

1. Откройте в браузере: `http://ваш_ip_адрес/`
2. Админка: `http://ваш_ip_адрес/admin/login.html`
3. Войдите с созданными credentials
4. Добавьте товары

## Обновление приложения

```bash
cd /var/www/biolab
git pull
npm install
pm2 restart biolab
```

## Резервное копирование

### Автоматический бэкап MongoDB

```bash
# Создание скрипта бэкапа
nano /root/backup-mongo.sh
```

Вставьте:

```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mongodump --db biolab --out $BACKUP_DIR/backup_$DATE
# Удаление старых бэкапов (старше 7 дней)
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

```bash
# Права на выполнение
chmod +x /root/backup-mongo.sh

# Добавление в cron (каждый день в 3:00)
crontab -e
```

Добавьте строку:
```
0 3 * * * /root/backup-mongo.sh
```

## Мониторинг

```bash
# Просмотр логов
pm2 logs biolab

# Статус приложения
pm2 status

# Использование ресурсов
pm2 monit
```

## Частые проблемы

**Приложение не запускается:**
```bash
pm2 logs biolab --lines 50
```

**MongoDB не работает:**
```bash
systemctl status mongod
journalctl -u mongod -n 50
```

**Порт занят:**
```bash
lsof -i :3000
kill -9 PID
```

## Стоимость

**Минимальная конфигурация:**
- VPS Timeweb: 150₽/месяц
- Домен .ru: 200₽/год (опционально)
- **Итого:** ~150₽/месяц

**Бесплатный вариант:**
- Локальный сервер в школе: 0₽
- Нужен только компьютер с Ubuntu

## Поддержка

**Email:** almetevskbiolab@gmail.com

---

*Все инструкции проверены для работы в России в 2026 году*
