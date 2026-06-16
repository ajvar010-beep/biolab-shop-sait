/**
 * requireLevel — middleware-фабрика проверки уровня доступа админа.
 *
 * Уровень берётся из req.admin.level (из БД, проставляется authMiddleware), а НЕ из JWT,
 * чтобы понижение/повышение уровня и принудительный выход действовали сразу, без перелогина.
 *
 * Ставить ПОСЛЕ authMiddleware: requireLevel(2) → доступно уровням 2 и 3.
 */
module.exports = function requireLevel(minLevel) {
  return (req, res, next) => {
    // Если authMiddleware не отработал — это ошибка порядка middleware, не пускаем.
    if (!req.admin) {
      return res.status(401).json({ message: 'Не авторизовано' });
    }
    const level = Number(req.admin.level) || 1;
    if (level < minLevel) {
      return res.status(403).json({ message: 'Недостаточно прав для этого действия' });
    }
    next();
  };
};
