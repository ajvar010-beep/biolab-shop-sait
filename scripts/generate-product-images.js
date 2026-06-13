/**
 * Генератор SVG-заглушек для товаров каталога.
 * Запуск: node scripts/generate-product-images.js
 * Создаёт assets/images/products/*.svg — локальные картинки без внешних CDN.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'products');

const PRODUCTS = [
  { slug: 'fialka',             title: 'Фиалка фиолетовая', emoji: '🌸', from: '#f3effe', to: '#d7c8f7' },
  { slug: 'pomidor-cherri',     title: 'Помидор черри',     emoji: '🍅', from: '#fdeeee', to: '#f6c9c9' },
  { slug: 'bazilik',            title: 'Базилик зелёный',   emoji: '🌱', from: '#eef9f0', to: '#c7ecd1' },
  { slug: 'rassada-perca',      title: 'Рассада перца',     emoji: '🌶️', from: '#fff2e6', to: '#fad9b8' },
  { slug: 'gortenziya',         title: 'Гортензия',         emoji: '🌺', from: '#fdeef6', to: '#f6cce2' },
  { slug: 'yablonya',           title: 'Яблоня молодая',    emoji: '🍎', from: '#f3faea', to: '#d6ecbb' },
  { slug: 'semena-podsolnuha',  title: 'Семена подсолнуха', emoji: '🌻', from: '#fffbe8', to: '#f7e7ad' },
  { slug: 'rassada-ogurca',     title: 'Рассада огурца',    emoji: '🥒', from: '#eafaf2', to: '#c2ecd6' },
  { slug: 'romashka',           title: 'Ромашка',           emoji: '🌼', from: '#fffced', to: '#f8edbf' },
  { slug: 'ukrop',              title: 'Укроп',             emoji: '🌿', from: '#eafaf1', to: '#c4ead4' }
];

function svg({ emoji, from, to }) {
  // Светлый пастельный фон + крупный эмодзи. Заголовок не впечатываем —
  // название товара показывается в карточке под изображением.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="130" cy="110" r="170" fill="#ffffff" opacity="0.35"/>
  <circle cx="690" cy="510" r="230" fill="#ffffff" opacity="0.28"/>
  <circle cx="660" cy="90" r="64" fill="#ffffff" opacity="0.40"/>
  <text x="400" y="310" font-size="230" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
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
