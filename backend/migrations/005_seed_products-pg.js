/**
 * PostgreSQL миграция 005: Добавить тестовые товары в каталог
 * Idempotent — проверяет наличие по названию перед добавлением.
 */

const crypto = require('crypto');

function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

const PRODUCTS = [
  {
    title: 'Фиалка фиолетовая',
    description: 'Красивое комнатное растение с бархатистыми листьями и яркими фиолетовыми цветками.',
    price: 450,
    category: 'Цветы',
    stock: 25,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=800&h=600&fit=crop"]',
    featured: true
  },
  {
    title: 'Помидор черри',
    description: 'Сладкие мини-помидоры для выращивания на подоконнике или в теплице.',
    price: 120,
    category: 'Овощи',
    stock: 40,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Базилик зелёный',
    description: 'Ароматная пряная зелень для кухни. Быстро растёт, многократно срезается.',
    price: 80,
    category: 'Зелень',
    stock: 60,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]',
    featured: true
  },
  {
    title: 'Рассада перца',
    description: 'Готовая к высадке рассада сладкого болгарского перца.',
    price: 65,
    category: 'Рассада',
    stock: 30,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Гортензия',
    description: 'Пышный кустарник с крупными соцветиями. Украсит любой сад.',
    price: 890,
    category: 'Кустарники',
    stock: 15,
    size: 'large',
    imageUrl: 'https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=800&h=600&fit=crop"]',
    featured: true
  },
  {
    title: 'Яблоня молодая',
    description: '2-летний саженец яблони. Устойчив к морозам, даёт плоды на 3-й год.',
    price: 1500,
    category: 'Деревья',
    stock: 10,
    size: 'large',
    imageUrl: 'https://images.unsplash.com/photo-1507003213457-2ad19c50a4b2?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1560969028-259ab67ca4b1?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Семена подсолнуха',
    description: 'Декоративный подсолнух для сада. Высота до 1.5 м, яркие жёлтые цветы.',
    price: 45,
    category: 'Семена',
    stock: 100,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Рассада огурца',
    description: 'Готовая рассада огурцов для открытого грунта или теплицы.',
    price: 55,
    category: 'Рассада',
    stock: 35,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Ромашка',
    description: 'Классическое полевое цветение. Неприхотливо, красиво, полезно.',
    price: 150,
    category: 'Цветы',
    stock: 50,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=800&h=600&fit=crop"]',
    featured: false
  },
  {
    title: 'Укроп',
    description: 'Пряная зелень для засолки и салатов. Быстрый урожай за 30 дней.',
    price: 40,
    category: 'Зелень',
    stock: 70,
    size: 'normal',
    imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]',
    featured: false
  }
];

module.exports = {
  id: 5,
  name: '005_seed_products-pg.js',
  async up(db) {
    let productsCount = 0;
    const now = new Date().toISOString();

    for (const prod of PRODUCTS) {
      const exists = await db.findOne('products', { title: prod.title });
      if (!exists) {
        await db.insert('products', {
          _id: makeId('prod'),
          ...prod,
          modelUrl: '',
          salePrice: null,
          saleStart: null,
          saleEnd: null,
          createdAt: now,
          updatedAt: now
        });
        productsCount++;
        console.log(`[Seed 005] Товар добавлен: ${prod.title}`);
      } else {
        console.log(`[Seed 005] Товар уже есть: ${prod.title}`);
      }
    }

    console.log(`[Seed 005] Добавлено товаров: ${productsCount}`);
  }
};
