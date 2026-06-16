/**
 * Admin Controller — управление аккаунтами админов и сменой своего пароля.
 *
 * Иерархия: актор может управлять только аккаунтами со СТРОГО меньшим уровнем
 * (canManage). Это значит, что два владельца (ур.3) не могут трогать друг друга —
 * защита от взаимной блокировки. Уровень всегда берётся из req.admin (из БД).
 *
 * Уровни: 1 — обычный админ, 2 — менеджер, 3 — владелец.
 * Снятие сессий / «выгнать» = инкремент tokenVersion (старые JWT становятся невалидны).
 * «Забрать админку» = удалить аккаунт.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const auth = require('./authController');
const audit = require('../services/audit');

const LEVELS = [1, 2, 3];

// Может ли actor управлять target (строго выше по уровню)
function canManage(actor, target) {
  return (Number(actor.level) || 1) > (Number(target.level) || 1);
}

// Безопасное представление аккаунта (без хэша пароля)
function publicAdmin(u) {
  return {
    id: u._id,
    username: u.username,
    level: Number(u.level) || 1,
    createdAt: u.createdAt
  };
}

// Найти управляемый аккаунт по :id с проверкой иерархии.
// Возвращает {error, status} либо {target}.
async function loadManageable(req) {
  const target = await db.findOne('users', { _id: req.params.id });
  if (!target) return { status: 404, error: 'Аккаунт не найден' };
  if (target._id === req.admin._id) return { status: 400, error: 'Нельзя выполнить это действие над собственным аккаунтом' };
  if (!canManage(req.admin, target)) return { status: 403, error: 'Недостаточно прав для управления этим аккаунтом' };
  return { target };
}

async function bumpTokenVersion(userId) {
  const u = await db.findOne('users', { _id: userId });
  const next = (Number(u && u.tokenVersion) || 0) + 1;
  await db.updateOne('users', { _id: userId }, { tokenVersion: next });
}

// GET /api/admins — аккаунты, которыми актор может управлять (строго ниже) + он сам.
exports.listAdmins = async (req, res) => {
  try {
    const all = await db.find('users');
    const myLevel = Number(req.admin.level) || 1;
    const list = all
      .filter(u => u._id === req.admin._id || (Number(u.level) || 1) < myLevel)
      .map(u => ({ ...publicAdmin(u), self: u._id === req.admin._id }))
      .sort((a, b) => b.level - a.level || String(a.username).localeCompare(b.username, 'ru'));
    res.json({ admins: list, myLevel });
  } catch (error) {
    console.error('Ошибка получения списка админов:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/admins — создать аккаунт (только ур.3). level создаваемого должен быть < своего.
exports.createAdmin = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const level = Number(req.body && req.body.level);

    const userErr = auth.validateUsername(username);
    if (userErr) return res.status(400).json({ message: userErr });
    const passErr = auth.validatePassword(password);
    if (passErr) return res.status(400).json({ message: passErr });
    if (!LEVELS.includes(level)) return res.status(400).json({ message: 'Уровень должен быть 1, 2 или 3' });
    if (level >= (Number(req.admin.level) || 1)) {
      return res.status(403).json({ message: 'Нельзя создать аккаунт с уровнем не ниже своего' });
    }

    const trimmedUsername = username.trim();
    const existing = await db.findOne('users', { username: trimmedUsername });
    if (existing) return res.status(400).json({ message: 'Аккаунт с таким логином уже существует' });

    const hashedPassword = await bcrypt.hash(password, auth.BCRYPT_ROUNDS);
    const id = 'admin_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await db.insert('users', {
      _id: id,
      username: trimmedUsername,
      password: hashedPassword,
      role: 'admin',
      level,
      tokenVersion: 0
    });

    await audit.log(req, {
      action: 'admin.create', targetType: 'admin', targetId: id, targetLabel: trimmedUsername,
      details: { level }
    });
    res.status(201).json({ message: 'Аккаунт создан', admin: { id, username: trimmedUsername, level } });
  } catch (error) {
    console.error('Ошибка создания аккаунта:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// DELETE /api/admins/:id — удалить аккаунт («забрать админку»).
exports.deleteAdmin = async (req, res) => {
  try {
    const { target, error, status } = await loadManageable(req);
    if (error) return res.status(status).json({ message: error });

    await db.deleteOne('users', { _id: target._id });
    await audit.log(req, {
      action: 'admin.delete', targetType: 'admin', targetId: target._id, targetLabel: target.username,
      details: { level: Number(target.level) || 1 }
    });
    res.json({ message: 'Аккаунт удалён' });
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// PUT /api/admins/:id/password — сменить пароль управляемого аккаунта (сбрасывает его сессии).
exports.setAdminPassword = async (req, res) => {
  try {
    const { target, error, status } = await loadManageable(req);
    if (error) return res.status(status).json({ message: error });

    const password = req.body && req.body.password;
    const passErr = auth.validatePassword(password);
    if (passErr) return res.status(400).json({ message: passErr });

    const hashedPassword = await bcrypt.hash(password, auth.BCRYPT_ROUNDS);
    await db.updateOne('users', { _id: target._id }, { password: hashedPassword });
    await bumpTokenVersion(target._id); // разлогинить активные сессии цели

    await audit.log(req, {
      action: 'admin.password', targetType: 'admin', targetId: target._id, targetLabel: target.username
    });
    res.json({ message: 'Пароль изменён' });
  } catch (error) {
    console.error('Ошибка смены пароля:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// PUT /api/admins/:id/level — сменить уровень (только ур.3). Новый уровень < своего.
exports.setAdminLevel = async (req, res) => {
  try {
    const { target, error, status } = await loadManageable(req);
    if (error) return res.status(status).json({ message: error });

    const newLevel = Number(req.body && req.body.level);
    if (!LEVELS.includes(newLevel)) return res.status(400).json({ message: 'Уровень должен быть 1, 2 или 3' });
    if (newLevel >= (Number(req.admin.level) || 1)) {
      return res.status(403).json({ message: 'Нельзя назначить уровень не ниже своего' });
    }

    await db.updateOne('users', { _id: target._id }, { level: newLevel });
    await bumpTokenVersion(target._id); // права изменились — обновим сессию

    await audit.log(req, {
      action: 'admin.level', targetType: 'admin', targetId: target._id, targetLabel: target.username,
      details: { from: Number(target.level) || 1, to: newLevel }
    });
    res.json({ message: 'Уровень изменён', level: newLevel });
  } catch (error) {
    console.error('Ошибка смены уровня:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// PUT /api/admins/:id/username — переименовать аккаунт (только ур.3).
exports.renameAdmin = async (req, res) => {
  try {
    const { target, error, status } = await loadManageable(req);
    if (error) return res.status(status).json({ message: error });

    const username = req.body && req.body.username;
    const userErr = auth.validateUsername(username);
    if (userErr) return res.status(400).json({ message: userErr });

    const trimmed = username.trim();
    const existing = await db.findOne('users', { username: trimmed });
    if (existing && existing._id !== target._id) {
      return res.status(400).json({ message: 'Логин уже занят' });
    }

    const oldName = target.username;
    await db.updateOne('users', { _id: target._id }, { username: trimmed });
    await audit.log(req, {
      action: 'admin.rename', targetType: 'admin', targetId: target._id, targetLabel: trimmed,
      details: { from: oldName, to: trimmed }
    });
    res.json({ message: 'Логин изменён', username: trimmed });
  } catch (error) {
    console.error('Ошибка переименования:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/admins/:id/logout — «выгнать» (сбросить активные сессии, аккаунт остаётся).
exports.forceLogout = async (req, res) => {
  try {
    const { target, error, status } = await loadManageable(req);
    if (error) return res.status(status).json({ message: error });

    await bumpTokenVersion(target._id);
    await audit.log(req, {
      action: 'admin.logout', targetType: 'admin', targetId: target._id, targetLabel: target.username
    });
    res.json({ message: 'Сессии аккаунта сброшены' });
  } catch (error) {
    console.error('Ошибка сброса сессий:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/admins/me/password — сменить свой пароль (любой уровень).
exports.changeOwnPassword = async (req, res) => {
  try {
    const currentPassword = req.body && req.body.currentPassword;
    const newPassword = req.body && req.body.newPassword;

    if (typeof currentPassword !== 'string') {
      return res.status(400).json({ message: 'Укажите текущий пароль' });
    }
    const passErr = auth.validatePassword(newPassword);
    if (passErr) return res.status(400).json({ message: passErr });

    const me = await db.findOne('users', { _id: req.admin._id });
    if (!me) return res.status(404).json({ message: 'Аккаунт не найден' });

    const ok = await bcrypt.compare(currentPassword, me.password);
    if (!ok) return res.status(400).json({ message: 'Текущий пароль неверен' });

    const hashedPassword = await bcrypt.hash(newPassword, auth.BCRYPT_ROUNDS);
    await db.updateOne('users', { _id: me._id }, { password: hashedPassword });
    await bumpTokenVersion(me._id); // выйти на всех остальных устройствах

    await audit.log(req, { action: 'admin.self_password', targetType: 'admin', targetId: me._id, targetLabel: me.username });
    res.json({ message: 'Пароль изменён. Войдите заново.' });
  } catch (error) {
    console.error('Ошибка смены своего пароля:', error.message);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
