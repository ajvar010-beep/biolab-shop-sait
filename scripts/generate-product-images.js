/**
 * Генератор SVG-заглушек для товаров каталога.
 * Запуск: node scripts/generate-product-images.js
 * Создаёт assets/images/products/*.svg — локальные картинки без внешних CDN.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'products');

const PRODUCTS = [
  { slug: 'fialka',             title: 'Фиалка фиолетовая', emoji: '🌸', from: '#ffffff', to: '#f1ecfb' },
  { slug: 'pomidor-cherri',     title: 'Помидор черри',     emoji: '🍅', from: '#ffffff', to: '#fceeee' },
  { slug: 'bazilik',            title: 'Базилик зелёный',   emoji: '🌱', from: '#ffffff', to: '#ecf7ef' },
  { slug: 'rassada-perca',      title: 'Рассада перца',     emoji: '🌶️', from: '#ffffff', to: '#fdf0e3' },
  { slug: 'gortenziya',         title: 'Гортензия',         emoji: '🌺', from: '#ffffff', to: '#fceaf3' },
  { slug: 'yablonya',           title: 'Яблоня молодая',    emoji: '🍎', from: '#ffffff', to: '#f1f8e6' },
  { slug: 'semena-podsolnuha',  title: 'Семена подсолнуха', emoji: '🌻', from: '#ffffff', to: '#fdf6dd' },
  { slug: 'rassada-ogurca',     title: 'Рассада огурца',    emoji: '🥒', from: '#ffffff', to: '#e9f7ef' },
  { slug: 'romashka',           title: 'Ромашка',           emoji: '🌼', from: '#ffffff', to: '#fdf7e2' },
  { slug: 'ukrop',              title: 'Укроп',             emoji: '🌿', from: '#ffffff', to: '#e9f7ef' }
];

function svg({ emoji, from, to }) {
  // Почти белый фон с лёгким оттенком + крупный эмодзи. Заголовок не впечатываем —
  // название товара показывается в карточке под изображением.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <text x="400" y="305" font-size="240" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
</svg>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const p of PRODUCTS) {
  const file = path.join(OUT_DIR, p.slug + '.svg');
  fs.writeFileSync(file, svg(p), 'utf8');
  console.log('OK', file);
}
console.log('Готово:', PRODUCTS.length, 'файлов');
