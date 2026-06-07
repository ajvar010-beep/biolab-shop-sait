/**
 * PostgreSQL миграция 003: Seed данные (категории и тестовые товары)
 * Idempotent — можно перезапускать безопасно.
 */

const crypto = require('crypto');

function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

const CATEGORIES = [
  { _id: 'cat_flowers', name: 'Цветы', slug: 'flowers', description: 'Комнатные и уличные цветы для вашего дома' },
  { _id: 'cat_vegetables', name: 'Овощи', slug: 'vegetables', description: 'Свежие овощные культуры' },
  { _id: 'cat_herbs', name: 'Зелень', slug: 'herbs', description: 'Ароматные травы и зелень' },
  { _id: 'cat_seedlings', name: 'Рассада', slug: 'seedlings', description: 'Готовая рассада для посадки' },
  { _id: 'cat_houseplants', name: 'Кустарники', slug: 'houseplants', description: 'Декоративные кустарники' },
  { _id: 'cat_trees', name: 'Деревья', slug: 'trees', description: 'Молодые деревья и саженцы' },
  { _id: 'cat_seeds', name: 'Семена', slug: 'seeds', description: 'Семена для самостоятельного выращивания' }
];

const PRODUCTS = [
  {
    title: 'Фиалка фиолетовая',
    description: 'Красивое комнатное растение с нежными фиолетовыми цветами. Легко ухаживать.',
    price: 150,
    category: 'Цветы',
    stock: 25,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Помидор черри',
    description: 'Молодые растения помидоров черри для вашего огорода. Отличный урожай.',
    price: 80,
    category: 'Овощи',
    stock: 40,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Базилик зелёный',
    description: 'Ароматный базилик для кулинарии. Идеален для пиццы и салатов.',
    price: 50,
    category: 'Зелень',
    stock: 60,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Рассада перца',
    description: 'Здоровая рассада сладкого перца. Созревает через 70-80 дней.',
    price: 45,
    category: 'Рассада',
    stock: 30,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Гортензия',
    description: 'Красивая гортензия с крупными соцветиями. Украсит любой сад.',
    price: 350,
    category: 'Кустарники',
    stock: 15,
    size: 'large',
    images: '[]'
  },
  {
    title: 'Яблоня молодая',
    description: 'Молодое дерево яблони. Даст первый урожай через 3-4 года.',
    price: 250,
    category: 'Деревья',
    stock: 10,
    size: 'large',
    images: '[]'
  },
  {
    title: 'Семена подсолнуха',
    description: 'Крупные семена подсолнуха для посадки. Высота до 2 метров.',
    price: 30,
    category: 'Семена',
    stock: 100,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Рассада огурца',
    description: 'Здоровая рассада огурцов для теплицы и открытого грунта.',
    price: 40,
    category: 'Рассада',
    stock: 35,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Ромашка',
    description: 'Декоративная ромашка с белыми лепестками. Простой уход.',
    price: 60,
    category: 'Цветы',
    stock: 50,
    size: 'normal',
    images: '[]'
  },
  {
    title: 'Укроп',
    description: 'Свежий укроп для ваших кулинарных шедевров.',
    price: 35,
    category: 'Зелень',
    stock: 70,
    size: 'normal',
    images: '[]'
  }
];

module.exports = {
  id: 3,
  name: '003_seed_data',

  async up(db) {
    let categoriesCount = 0;
    let productsCount = 0;

    // ─── Категории (idempotent) ───
    for (const cat of CATEGORIES) {
      const exists = await db.findOne('categories', { name: cat.name });
      if (!exists) {
        await db.insert('categories', {
          ...cat,
          createdAt: new Date().toISOString()
        });
        categoriesCount++;
        console.log(`[Seed] Категория добавлена: ${cat.name}`);
      } else {
        console.log(`[Seed] Категория уже есть: ${cat.name}`);
      }
    }

    // ─── Товары (idempotent — по названию) ───
    for (const prod of PRODUCTS) {
      const exists = await db.findOne('products', { title: prod.title });
      if (!exists) {
        const now = new Date().toISOString();
        await db.insert('products', {
          _id: makeId('prod'),
          ...prod,
          imageUrl: '',
          modelUrl: '',
          salePrice: null,
          saleStart: null,
          saleEnd: null,
          createdAt: now,
          updatedAt: now
        });
        productsCount++;
        console.log(`[Seed] Товар добавлен: ${prod.title}`);
      } else {
        console.log(`[Seed] Товар уже есть: ${prod.title}`);
      }
    }

    console.log('[Seed] Данные инициализированы');

    return {
      categories_count: categoriesCount,
      products_count: productsCount,
      success: true
    };
  }
};
