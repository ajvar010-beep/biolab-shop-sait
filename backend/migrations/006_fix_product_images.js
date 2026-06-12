/**
 * SQLite миграция 006: Заменить битые Unsplash-картинки на локальные SVG.
 * Unsplash отдаёт 403 (URL из seed-данных не существуют) — на сайте вместо фото
 * отображались пустые блоки. Локальные файлы лежат в assets/images/products/.
 * Idempotent — трогает только строки с images.unsplash.com.
 */

const IMAGE_MAP = {
  'Фиалка фиолетовая': 'fialka',
  'Помидор черри': 'pomidor-cherri',
  'Базилик зелёный': 'bazilik',
  'Рассада перца': 'rassada-perca',
  'Гортензия': 'gortenziya',
  'Яблоня молодая': 'yablonya',
  'Семена подсолнуха': 'semena-podsolnuha',
  'Рассада огурца': 'rassada-ogurca',
  'Ромашка': 'romashka',
  'Укроп': 'ukrop'
};

module.exports = {
  id: 6,
  name: '006_fix_product_images',

  async up(db) {
    let updated = 0;
    const now = new Date().toISOString();

    for (const [title, slug] of Object.entries(IMAGE_MAP)) {
      const local = `/assets/images/products/${slug}.svg`;
      const result = await db.run(
        `UPDATE products
         SET imageUrl = ?, images = ?, updatedAt = ?
         WHERE title = ? AND imageUrl LIKE '%images.unsplash.com%'`,
        [local, JSON.stringify([local]), now, title]
      );
      updated += result.changes || 0;
    }

    // Прочие товары с Unsplash-ссылками (если есть) — убираем битую картинку
    const rest = await db.run(
      `UPDATE products
       SET imageUrl = '', images = '[]', updatedAt = ?
       WHERE imageUrl LIKE '%images.unsplash.com%'`,
      [now]
    );

    console.log(`[Миграция 006] Картинки обновлены: ${updated}, очищено прочих: ${rest.changes || 0}`);
  }
};
