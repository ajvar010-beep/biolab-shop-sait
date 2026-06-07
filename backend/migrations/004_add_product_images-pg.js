/**
 * PostgreSQL миграция 004: Добавить картинки к тестовым товарам
 * Idempotent — обновляет только товары без imageUrl
 */

const IMAGE_MAP = {
  'Фиалка фиолетовая': {
    imageUrl: 'https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1487527040587-8c6a67e85b64?w=800&h=600&fit=crop"]'
  },
  'Помидор черри': {
    imageUrl: 'https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1592841200221-a3f6e03c36e6?w=800&h=600&fit=crop"]'
  },
  'Базилик зелёный': {
    imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]'
  },
  'Рассада перца': {
    imageUrl: 'https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1568480704474-d55e47e9af03?w=800&h=600&fit=crop"]'
  },
  'Гортензия': {
    imageUrl: 'https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1468439237565-2b249928f5a0?w=800&h=600&fit=crop"]'
  },
  'Яблоня молодая': {
    imageUrl: 'https://images.unsplash.com/photo-1507003213457-2ad19c50a4b2?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1560969028-259ab67ca4b1?w=800&h=600&fit=crop"]'
  },
  'Семена подсолнуха': {
    imageUrl: 'https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1551687663-bc3c0de2ca5f?w=800&h=600&fit=crop"]'
  },
  'Рассада огурца': {
    imageUrl: 'https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1447175301003-33f4985107c4?w=800&h=600&fit=crop"]'
  },
  'Ромашка': {
    imageUrl: 'https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1490751746386-2e0c4f2f502f?w=800&h=600&fit=crop"]'
  },
  'Укроп': {
    imageUrl: 'https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=400&h=300&fit=crop',
    images: '["https://images.unsplash.com/photo-1618378927878-7dc73682e8e3?w=800&h=600&fit=crop"]'
  }
};

module.exports = {
  id: 4,
  name: '004_add_product_images',

  async up(db) {
    let updated = 0;

    for (const [title, imgData] of Object.entries(IMAGE_MAP)) {
      const product = await db.findOne('products', { title });
      if (product && (!product.imageUrl || product.imageUrl === '')) {
        await db.updateOne('products', { _id: product._id }, {
          imageUrl: imgData.imageUrl,
          images: imgData.images,
          updatedAt: new Date().toISOString()
        });
        updated++;
        console.log(`[Migration 004] Картинка добавлена: ${title}`);
      } else if (product) {
        console.log(`[Migration 004] Уже есть картинка: ${title}`);
      } else {
        console.log(`[Migration 004] Товар не найден: ${title}`);
      }
    }

    // Также добавим тестовые товары если их нет (re-seed)
    const crypto = require('crypto');
    function makeId(prefix) {
      return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    }

    const MISSING_PRODUCTS = [
      {
        title: 'Фиалка фиолетовая',
        description: 'Красивое комнатное растение с нежными фиолетовыми цветами. Легко ухаживать.',
        price: 150, category: 'Цветы', stock: 25, size: 'normal'
      },
      {
        title: 'Помидор черри',
        description: 'Молодые растения помидоров черри для вашего огорода. Отличный урожай.',
        price: 80, category: 'Овощи', stock: 40, size: 'normal'
      },
      {
        title: 'Базилик зелёный',
        description: 'Ароматный базилик для кулинарии. Идеален для пиццы и салатов.',
        price: 50, category: 'Зелень', stock: 60, size: 'normal'
      },
      {
        title: 'Рассада перца',
        description: 'Здоровая рассада сладкого перца. Созревает через 70-80 дней.',
        price: 45, category: 'Рассада', stock: 30, size: 'normal'
      },
      {
        title: 'Гортензия',
        description: 'Красивая гортензия с крупными соцветиями. Украсит любой сад.',
        price: 350, category: 'Кустарники', stock: 15, size: 'large'
      },
      {
        title: 'Яблоня молодая',
        description: 'Молодое дерево яблони. Даст первый урожай через 3-4 года.',
        price: 250, category: 'Деревья', stock: 10, size: 'large'
      },
      {
        title: 'Семена подсолнуха',
        description: 'Крупные семена подсолнуха для посадки. Высота до 2 метров.',
        price: 30, category: 'Семена', stock: 100, size: 'normal'
      },
      {
        title: 'Рассада огурца',
        description: 'Здоровая рассада огурцов для теплицы и открытого грунта.',
        price: 40, category: 'Рассада', stock: 35, size: 'normal'
      },
      {
        title: 'Ромашка',
        description: 'Декоративная ромашка с белыми лепестками. Простой уход.',
        price: 60, category: 'Цветы', stock: 50, size: 'normal'
      },
      {
        title: 'Укроп',
        description: 'Свежий укроп для ваших кулинарных шедевров.',
        price: 35, category: 'Зелень', stock: 70, size: 'normal'
      }
    ];

    for (const prod of MISSING_PRODUCTS) {
      const exists = await db.findOne('products', { title: prod.title });
      if (!exists) {
        const img = IMAGE_MAP[prod.title] || { imageUrl: '', images: '[]' };
        const now = new Date().toISOString();
        await db.insert('products', {
          _id: makeId('prod'),
          ...prod,
          ...img,
          modelUrl: '',
          salePrice: null,
          saleStart: null,
          saleEnd: null,
          createdAt: now,
          updatedAt: now
        });
        updated++;
        console.log(`[Migration 004] Товар добавлен: ${prod.title}`);
      }
    }

    console.log(`[Migration 004] Обновлено/добавлено: ${updated}`);
    return { updated, success: true };
  }
};
