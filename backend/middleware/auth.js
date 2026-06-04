/**
 * Auth Middleware - SQLite версия
 */
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.header('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Доступ запрещен. Токен не предоставлен.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof decoded.adminId !== 'string') {
      return res.status(401).json({ message: 'Недействительный токен' });
    }

    const admin = await db.findOne('users', { _id: decoded.adminId });
    if (!admin) {
      return res.status(401).json({ message: 'Админ не найден' });
    }
    if (typeof decoded.tv !== 'number' || decoded.tv !== (admin.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Сессия завершена. Войдите заново.' });
    }

    req.adminId = admin._id;
    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истёк' });
    }
    res.status(401).json({ message: 'Недействительный токен' });
  }
};

module.exports = authMiddleware;