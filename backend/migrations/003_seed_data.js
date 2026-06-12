/**
 * SQLite миграция 003: Seed данные (категории и тестовые товары)
 * Idempotent — можно перезапускать безопасно.
 */

module.exports = {
  id: 3,
  name: '003_seed_data',

  async up(db) {
    let categoriesCount = 0;
    let productsCount = 0;

    // ─── Категории (idempotent по name) ───
    const CATEGORIES = [
      { _id: 'cat_flowers', name: 'Цветы', slug: 'flowers', description: 'Комнатные и уличные цветы для вашего дома' },
      { _id: 'cat_vegetables', name: 'Овощи', slug: 'vegetables', description: 'Свежие овощные культуры' },
      { _id: 'cat_herbs', name: 'Зелень', slug: 'herbs', description: 'Ароматные травы и зелень' },
      { _id: 'cat_seedlings', name: 'Рассада', slug: 'seedlings', description: 'Готовая рассада для посадки' },
      { _id: 'cat_houseplants', name: 'Кустарники', slug: 'houseplants', description: 'Декоративные кустарники' },
      { _id: 'cat_trees', name: 'Деревья', slug: 'trees', description: 'Молодые деревья и саженцы' },
      { _id: 'cat_seeds', name: 'Семена', slug: 'seeds', description: 'Семена для самостоятельного выращивания' }
    ];

    for (const cat of CATEGORIES) {
      const exists = await db.findOne('categories', { name: cat.name });
      if (!exists) {
        await db.insert('categories', {
          ...cat,
          createdAt: new Date().toISOString()
        });
        categoriesCount++;
        console.log(`[Seed 003] Категория добавлена: ${cat.name}`);
      } else {
        console.log(`[Seed 003] Категория уже есть: ${cat.name}`);
      }
    }

    // ─── Товары (idempotent по title) ───
    const PRODUCTS = [
      {
        title: 'Фиалка фиолетовая',
        description: 'Красивое комнатное растение с нежными фиолетовыми цветами. Легко ухаживать.',
        price: 150, category: 'Цветы', stock: 25, size: 'normal',
        imageUrl: '/assets/images/products/fialka.svg',
        images: '["/assets/images/products/fialka.svg"]'
      },
      {
        title: 'Помидор черри',
        description: 'Молодые растения помидоров черри для вашего огорода. Отличный урожай.',
        price: 80, category: 'Овощи', stock: 40, size: 'normal',
        imageUrl: '/assets/images/products/pomidor-cherri.svg',
        images: '["/assets/images/products/pomidor-cherri.svg"]'
      },
      {
        title: 'Базилик зелёный',
        description: 'Ароматный базилик для кулинарии. Идеален для пиццы и салатов.',
        price: 50, category: 'Зелень', stock: 60, size: 'normal',
        imageUrl: '/assets/images/products/bazilik.svg',
        images: '["/assets/images/products/bazilik.svg"]'
      },
      {
        title: 'Рассада перца',
        description: 'Здоровая рассада сладкого перца. Созревает через 70-80 дней.',
        price: 45, category: 'Рассада', stock: 30, size: 'normal',
        imageUrl: '/assets/images/products/rassada-perca.svg',
        images: '["/assets/images/products/rassada-perca.svg"]'
      },
      {
        title: 'Гортензия',
        description: 'Красивая гортензия с крупными соцветиями. Украсит любой сад.',
        price: 350, category: 'Кустарники', stock: 15, size: 'large',
        imageUrl: '/assets/images/products/gortenziya.svg',
        images: '["/assets/images/products/gortenziya.svg"]'
      },
      {
        title: 'Яблоня молодая',
        description: 'Молодое дерево яблони. Даст первый урожай через 3-4 года.',
        price: 250, category: 'Деревья', stock: 10, size: 'large',
        imageUrl: '/assets/images/products/yablonya.svg',
        images: '["/assets/images/products/yablonya.svg"]'
      },
      {
        title: 'Семена подсолнуха',
        description: 'Крупные семена подсолнуха для посадки. Высота до 2 метров.',
        price: 30, category: 'Семена', stock: 100, size: 'normal',
        imageUrl: '/assets/images/products/semena-podsolnuha.svg',
        images: '["/assets/images/products/semena-podsolnuha.svg"]'
      },
      {
        title: 'Рассада огурца',
        description: 'Здоровая рассада огурцов для теплицы и открытого грунта.',
        price: 40, category: 'Рассада', stock: 35, size: 'normal',
        imageUrl: '/assets/images/products/rassada-ogurca.svg',
        images: '["/assets/images/products/rassada-ogurca.svg"]'
      },
      {
        title: 'Ромашка',
        description: 'Декоративная ромашка с белыми лепестками. Простой уход.',
        price: 60, category: 'Цветы', stock: 50, size: 'normal',
        imageUrl: '/assets/images/products/romashka.svg',
        images: '["/assets/images/products/romashka.svg"]'
      },
      {
        title: 'Укроп',
        description: 'Свежий укроп для ваших кулинарных шедевров.',
        price: 35, category: 'Зелень', stock: 70, size: 'normal',
        imageUrl: '/assets/images/products/ukrop.svg',
        images: '["/assets/images/products/ukrop.svg"]'
      }
    ];

    for (const prod of PRODUCTS) {
      const exists = await db.findOne('products', { title: prod.title });
      if (!exists) {
        const now = new Date().toISOString();
        await db.insert('products', {
          _id: 'prod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
          ...prod,
          modelUrl: '',
          salePrice: null,
          saleStart: null,
          saleEnd: null,
          createdAt: now,
          updatedAt: now
        });
        productsCount++;
        console.log(`[Seed 003] Товар добавлен: ${prod.title}`);
      } else {
        console.log(`[Seed 003] Товар уже есть: ${prod.title}`);
      }
    }

    console.log(`[Seed 003] Готово. Категорий: ${categoriesCount}, товаров: ${productsCount}`);
  }
};
