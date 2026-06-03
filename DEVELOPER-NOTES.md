# 📝 Памятка для разработчика

**Обновлено:** 03.06.2026
**Версия:** Biolab v1.2.0
**База данных:** SQLite (sql.js)

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

# Запустить сервер
npm start

# Создать админа
node scripts/create-admin.js

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
- [x] `backend/config/database.js` переписан на sql.js
- [x] Все контроллеры адаптированы
- [x] Транзакции SQLite реализованы
- [x] `npm install` выполнен
- [ ] **TODO:** Настроить автоматический backup `data/biolab.db` по расписанию

## 📊 Структура базы данных (SQLite)

```
users       — админы (username, password bcrypt hash, role, tokenVersion)
categories  — категории товаров (name, slug, description, imageUrl)
products    — товары (title, description, price, stock, category, images, modelUrl, size, salePrice)
orders      — заказы (orderCode, customerName, customerPhone, customerEmail, items JSON, totalPrice, status, qrCode)
settings    — настройки магазина (email, phone, address, socials JSON, aboutText)
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

## 📞 Контакты для экстренных случаев

**Хостинг:** Render.com support
**Node.js:** nodejs.org/community
**SQLite:** sqlite.org

---

**Помни:** Безопасность важнее скорости разработки! 🔒
