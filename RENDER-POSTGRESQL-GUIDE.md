# Инструкция: Миграция на PostgreSQL на Render

## Зачем?

Render.com **бесплатно** даёт persistent PostgreSQL базу данных. Это означает:
- Данные **не пропадут** при перезапуске сервера
- Данные **сохраняются** между деплоями
- Это заменит SQLite, который стирается на бесплатном плане

---

## Шаг 1: Создать PostgreSQL на Render

1. Зайди в [Render Dashboard](https://dashboard.render.com)
2. Нажми **"New +"** → **"PostgreSQL"**
3. Заполни:
   - **Name:** `biolab-db` (или любое)
   - **Database:** `biolab`
   - **User:** `biolab` (или оставь по умолчанию)
4. **Free** план → **Create Database**
5. **Подожди** пока статус станет **Available** (1-2 минуты)

---

## Шаг 2: Скопировать DATABASE_URL

1. В созданной PostgreSQL базе нажми **"Connect"** → **"General"**
2. Скопируй поле **"Internal Database URL"**
   - Формат: `postgresql://biolab:xxxxx@dd-mm.render.com:5432/biolab`

---

## Шаг 3: Настроить Web Service

1. Открой свой **Web Service** (biolab-shop-sait)
2. Перейди в **"Environment"** (вкладка)
3. В секции **"Environment Variables"** добавь:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Вставь скопированный URL из шага 2 |
   | `NODE_ENV` | `production` |
   | `ALLOWED_ORIGINS` | `https://biolab-shop-sait.onrender.com` |

4. **Save Changes**

---

## Шаг 4: Trigger Deploy

1. Нажми **"Deployments"** → **"Deploy latest commit"**
2. Или сделай push в GitHub — Render автоматически задеплоит

---

## Шаг 5: Проверка

После деплоя открой логи сервера. Должно быть:

```
[PostgreSQL] Подключение к базе данных...
[Миграция 1] Выполняем: 001_initial_schema...
[Миграция] PostgreSQL схема БД создана
[Миграция 2] Выполняем: 002_seed_categories...
[Миграция] Категории созданы: 5
[PostgreSQL] База данных инициализирована
```

---

## Что происходит

1. При запуске сервер проверяет `DATABASE_URL`
2. Если задан → используется **PostgreSQL**
3. Если не задан → используется **SQLite** (локально)
4. Миграции автоматически создают таблицы и seed-данные

---

## Важно

- **Не удаляй** старый Web Service пока не проверишь новый
- Все товары, заказы, категории добавляй заново через админку (seed данные создадутся автоматически)
- Если нужно **перенести данные** со старой SQLite — напиши скрипт миграции

---

## Откат

Если что-то пошло не так:
1. Удали переменную `DATABASE_URL` из Environment
2. Задеплой снова — вернётся на SQLite
3. SQLite на Render всё ещё работает, просто данные не persist между рестартами

---

## Скриншоты

### Render Dashboard - New PostgreSQL:
```
[New +] → [PostgreSQL] → Name: biolab-db → Free → Create Database
```

### Environment Variables:
```
DATABASE_URL = postgresql://user:pass@host:5432/dbname
NODE_ENV = production
ALLOWED_ORIGINS = https://biolab-shop-sait.onrender.com
```
