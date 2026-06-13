/**
 * SQLite миграция 007: Удалить 5 пустых категорий из миграции 002.
 * Аналог -pg версии для локальной разработки.
 * Idempotent — удаляет только пустые категории старого набора по seed-id.
 */

const LEGACY_IDS = ['cat_seed_1', 'cat_seed_2', 'cat_seed_3', 'cat_seed_4', 'cat_seed_5'];

module.exports = {
  id: 7,
  name: '007_cleanup_seed_categories',

  async up(db) {
    let removed = 0;
    for (const id of LEGACY_IDS) {
      const cat = await db.get('SELECT _id, name FROM categories WHERE _id = ? LIMIT 1', [id]);
      if (!cat) continue;

      const inUse = await db.get('SELECT 1 FROM products WHERE category = ? LIMIT 1', [cat.name]);
      if (inUse) {
        console.log(`[Миграция 007] Пропускаем "${cat.name}" — есть товары`);
        continue;
      }

      await db.run('DELETE FROM categories WHERE _id = ?', [id]);
      removed++;
      console.log(`[Миграция 007] Удалена пустая категория: ${cat.name}`);
    }
    console.log(`[Миграция 007] Готово. Удалено категорий: ${removed}`);
  }
};
