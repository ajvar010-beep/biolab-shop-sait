/**
 * PostgreSQL миграция 007: Удалить 5 пустых категорий из миграции 002.
 *
 * 002 засеяла «Комнатные растения / Садовые растения / Экзотические растения /
 * Удобрения и грунты / Горшки и кашпо», но товары (003) используют другой набор
 * («Цветы, Овощи, Зелень, Рассада, Кустарники, Деревья, Семена»). В итоге на проде
 * 12 категорий, 5 из которых пустые — лишние кнопки фильтра.
 *
 * Удаляем только пустые (без товаров) и только из «старого» набора по их seed-id.
 * Idempotent — если их уже нет, ничего не делает.
 */

const LEGACY_IDS = ['cat_seed_1', 'cat_seed_2', 'cat_seed_3', 'cat_seed_4', 'cat_seed_5'];

module.exports = {
  id: 7,
  name: '007_cleanup_seed_categories',

  async up(db) {
    let removed = 0;
    for (const id of LEGACY_IDS) {
      const cat = await db.get('SELECT _id, name FROM categories WHERE _id = $1 LIMIT 1', [id]);
      if (!cat) continue;

      // Не трогаем категорию, если в ней внезапно оказались товары
      const inUse = await db.get('SELECT 1 FROM products WHERE category = $1 LIMIT 1', [cat.name]);
      if (inUse) {
        console.log(`[Миграция 007] Пропускаем "${cat.name}" — есть товары`);
        continue;
      }

      await db.run('DELETE FROM categories WHERE _id = $1', [id]);
      removed++;
      console.log(`[Миграция 007] Удалена пустая категория: ${cat.name}`);
    }
    console.log(`[Миграция 007] Готово. Удалено категорий: ${removed}`);
  }
};
