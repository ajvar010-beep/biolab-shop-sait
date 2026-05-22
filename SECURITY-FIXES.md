# Исправления безопасности для Biolab

## Критические исправления (НЕМЕДЛЕННО)

### 1. Сменить JWT Secret
```bash
# Сгенерировать новый секрет
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Заменить в `.env`:
```
JWT_SECRET=ваш_новый_64_символьный_ключ
```

### 2. Закрыть публичную регистрацию админов
В `backend/routes/auth.js` закомментировать:
```javascript
// router.post('/register', authController.register);
```

Или добавить middleware проверки:
```javascript
const requireSuperAdmin = (req, res, next) => {
  // Проверить что это первый админ или есть спец. токен
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return res.status(403).json({ message: 'Регистрация отключена' });
  }
  next();
};

router.post('/register', requireSuperAdmin, authController.register);
```

### 3. Настроить CORS правильно
В `backend/server.js`:
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));
```

## Высокий приоритет

### 4. Добавить Rate Limiting
```bash
npm install express-rate-limit
```

В `backend/server.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с IP
  message: 'Слишком много запросов, попробуйте позже'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // только 5 попыток входа
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
```

### 5. Валидация ObjectId
```bash
npm install mongoose-validator
```

В контроллерах:
```javascript
const mongoose = require('mongoose');

// Проверка валидности ObjectId
if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({ message: 'Неверный ID' });
}
```

### 6. Добавить helmet для безопасности заголовков
```bash
npm install helmet
```

В `backend/server.js`:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 7. Улучшить проверку файлов
```bash
npm install file-type
```

В `productController.js`:
```javascript
const FileType = require('file-type');

// В fileFilter добавить:
fileFilter: async (req, file, cb) => {
  try {
    const fileTypeResult = await FileType.fromBuffer(file.buffer);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (fileTypeResult && allowedTypes.includes(fileTypeResult.mime)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  } catch (error) {
    cb(new Error('Ошибка проверки файла'));
  }
}
```

## Средний приоритет

### 8. Безопасное хранение токенов
Заменить localStorage на httpOnly cookies:

В `backend/controllers/authController.js`:
```javascript
// При логине
res.cookie('adminToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
});
```

### 9. Добавить HTTPS редирект
В `backend/server.js`:
```javascript
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### 10. Логирование безопасности
```bash
npm install winston
```

Добавить логирование подозрительной активности:
- Неудачные попытки входа
- Множественные запросы с одного IP
- Попытки доступа к админским функциям

### 11. Валидация входных данных
```bash
npm install joi
```

Добавить схемы валидации для всех API endpoints.

### 12. Обновить зависимости
```bash
npm audit
npm audit fix
```

## Переменные окружения для продакшна

Добавить в `.env`:
```
# Безопасность
ALLOW_REGISTRATION=false
BCRYPT_ROUNDS=12
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cookies
COOKIE_SECRET=ваш_секрет_для_cookies
```

## Чек-лист перед деплоем

- [ ] Сменен JWT_SECRET
- [ ] Отключена публичная регистрация
- [ ] Настроен CORS
- [ ] Добавлен rate limiting
- [ ] Установлен helmet
- [ ] Обновлены все зависимости
- [ ] Настроено логирование
- [ ] Проведен npm audit
- [ ] Настроен HTTPS
- [ ] Созданы резервные копии БД