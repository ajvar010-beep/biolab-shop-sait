/**
 * Генератор SVG-заглушек для товаров каталога.
 * Запуск: node scripts/generate-product-images.js
 * Создаёт assets/images/products/*.svg — локальные картинки без внешних CDN.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'images', 'products');

const PRODUCTS = [
  { slug: 'fialka',             title: 'Фиалка фиолетовая', emoji: '🌸', from: '#a78bfa', to: '#6d28d9' },
  { slug: 'pomidor-cherri',     title: 'Помидор черри',     emoji: '🍅', from: '#fca5a5', to: '#b91c1c' },
  { slug: 'bazilik',            title: 'Базилик зелёный',   emoji: '🌱', from: '#86efac', to: '#15803d' },
  { slug: 'rassada-perca',      title: 'Рассада перца',     emoji: '🌶️', from: '#fdba74', to: '#c2410c' },
  { slug: 'gortenziya',         title: 'Гортензия',         emoji: '🌺', from: '#f9a8d4', to: '#9d174d' },
  { slug: 'yablonya',           title: 'Яблоня молодая',    emoji: '🍎', from: '#bef264', to: '#3f6212' },
  { slug: 'semena-podsolnuha',  title: 'Семена подсолнуха', emoji: '🌻', from: '#fde047', to: '#a16207' },
  { slug: 'rassada-ogurca',     title: 'Рассада огурца',    emoji: '🥒', from: '#6ee7b7', to: '#047857' },
  { slug: 'romashka',           title: 'Ромашка',           emoji: '🌼', from: '#fef9c3', to: '#ca8a04' },
  { slug: 'ukrop',              title: 'Укроп',             emoji: '🌿', from: '#a7f3d0', to: '#065f46' }
];

function svg({ title, emoji, from, to }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="120" cy="100" r="160" fill="#ffffff" opacity="0.10"/>
  <circle cx="700" cy="520" r="220" fill="#ffffff" opacity="0.08"/>
  <circle cx="650" cy="80" r="60" fill="#ffffff" opacity="0.12"/>
  <text x="400" y="320" font-size="190" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="400" y="510" font-size="44" font-weight="700" text-anchor="middle"
        font-family="Segoe UI, Arial, sans-serif" fill="#ffffff" opacity="0.95">${title}</text>
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
