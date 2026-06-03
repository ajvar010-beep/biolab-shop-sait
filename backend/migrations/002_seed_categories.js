/**
 * Миграция 002: Начальные данные категорий
 */
module.exports = {
  id: 2,
  name: '002_seed_categories',

  up(db) {
    // Проверяем, есть ли уже категории
    const existing = db.countDocuments('categories');
    if (existing > 0) {
      console.log('[Миграция] Категории уже существуют, пропускаем');
      return;
    }

    const categories = [
      { name: 'Комнатные растения', description: 'Растения для дома и квартиры', imageUrl: '' },
      { name: 'Садовые растения', description: 'Для сада и огорода', imageUrl: '' },
      { name: 'Экзотические растения', description: 'Редкие и необычные виды', imageUrl: '' },
      { name: 'Удобрения и грунты', description: 'Всё для ухода за растениями', imageUrl: '' },
      { name: 'Горшки и кашпо', description: 'Ёмкости для растений', imageUrl: '' }
    ];

    const now = new Date().toISOString();
    categories.forEach((cat, i) => {
      const slug = cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-я0-9-]/g, '');
      db.insert('categories', {
        _id: `cat_seed_${i + 1}`,
        name: cat.name,
        slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        createdAt: now
      });
    });

    console.log('[Миграция] Категории созданы:', categories.length);
  }
};
