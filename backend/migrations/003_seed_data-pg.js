/**
 * PostgreSQL миграция 003: Seed данные (категории и тестовые товары)
 * Idempotent — можно перезапускать безопасно.
 * Использует db.run() напрямую для максимальной надёжности.
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
      const exists = await db.get('SELECT * FROM categories WHERE name = $1 LIMIT 1', [cat.name]);
      if (!exists) {
        await db.run(
          'INSERT INTO categories (_id, name, slug, description, imageUrl, createdAt) VALUES ($1, $2, $3, $4, $5, $6)',
          [cat._id, cat.name, cat.slug, cat.description, '', new Date().toISOString()]
        );
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
        imageUrl: 'https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Помидор черри',
        description: 'Молодые растения помидоров черри для вашего огорода. Отличный урожай.',
        price: 80, category: 'Овощи', stock: 40, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Базилик зелёный',
        description: 'Ароматный базилик для кулинарии. Идеален для пиццы и салатов.',
        price: 50, category: 'Зелень', stock: 60, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Рассада перца',
        description: 'Здоровая рассада сладкого перца. Созревает через 70-80 дней.',
        price: 45, category: 'Рассада', stock: 30, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Гортензия',
        description: 'Красивая гортензия с крупными соцветиями. Украсит любой сад.',
        price: 350, category: 'Кустарники', stock: 15, size: 'large',
        imageUrl: 'https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Яблоня молодая',
        description: 'Молодое дерево яблони. Даст первый урожай через 3-4 года.',
        price: 250, category: 'Деревья', stock: 10, size: 'large',
        imageUrl: 'https://images.unsplash.com/photo-1507003213457-2ad19c50a4b2?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1560969028-259ab67ca4b1?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Семена подсолнуха',
        description: 'Крупные семена подсолнуха для посадки. Высота до 2 метров.',
        price: 30, category: 'Семена', stock: 100, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Рассада огурца',
        description: 'Здоровая рассада огурцов для теплицы и открытого грунта.',
        price: 40, category: 'Рассада', stock: 35, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Ромашка',
        description: 'Декоративная ромашка с белыми лепестками. Простой уход.',
        price: 60, category: 'Цветы', stock: 50, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=800&h=600&fit=crop"]'
      },
      {
        title: 'Укроп',
        description: 'Свежий укроп для ваших кулинарных шедевров.',
        price: 35, category: 'Зелень', stock: 70, size: 'normal',
        imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
        images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]'
      }
    ];

    for (const prod of PRODUCTS) {
      const exists = await db.get('SELECT * FROM products WHERE title = $1 LIMIT 1', [prod.title]);
      if (!exists) {
        const now = new Date().toISOString();
        await db.run(
          `INSERT INTO products (_id, title, description, price, category, stock, size, imageUrl, images, modelUrl, salePrice, saleStart, saleEnd, createdAt, updatedAt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [`prod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, prod.title, prod.description, prod.price, prod.category, prod.stock, prod.size, prod.imageUrl, prod.images, '', null, null, null, now, now]
        );
        productsCount++;
        console.log(`[Seed 003] Товар добавлен: ${prod.title}`);
      } else {
        console.log(`[Seed 003] Товар уже есть: ${prod.title}`);
      }
    }

    console.log(`[Seed 003] Готово. Категорий: ${categoriesCount}, товаров: ${productsCount}`);
  }
};
