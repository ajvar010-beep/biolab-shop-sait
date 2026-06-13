/**
 * Генератор sitemap.xml для Biolab
 * Создаёт sitemap.xml из списка товаров + статических страниц
 */
const db = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://biolab-shop-sait.onrender.com';

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSitemap() {
  console.log('[Sitemap] Генерация sitemap.xml...');

  // Получаем все товары (методы адаптера асинхронные)
  const products = await db.find('products');
  const categories = await db.find('categories');

  const now = new Date().toISOString().split('T')[0];

  const staticPages = [
    { url: '', priority: '1.0', changefreq: 'weekly' },
    { url: 'index.html', priority: '1.0', changefreq: 'weekly' },
    { url: 'admin/', priority: '0.5', changefreq: 'monthly' }
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Статические страницы
  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${FRONTEND_URL}/${page.url}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  // Категории
  for (const cat of categories) {
    const slug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-');
    xml += '  <url>\n';
    xml += `    <loc>${FRONTEND_URL}/?category=${encodeURIComponent(slug)}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += '    <priority>0.7</priority>\n';
    xml += '  </url>\n';
  }

  // Товары
  for (const product of products) {
    const lastmod = product.updatedAt ? product.updatedAt.split('T')[0] : now;
    xml += '  <url>\n';
    xml += `    <loc>${FRONTEND_URL}/?product=${product._id}</loc>\n`;
    xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  }

  xml += '</urlset>\n';

  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml, 'utf-8');
  console.log(`[Sitemap] ✅ Создан: ${outputPath}`);
  console.log(`[Sitemap] Статических страниц: ${staticPages.length}, категорий: ${categories.length}, товаров: ${products.length}`);
}

if (require.main === module) {
  (async () => {
    try {
      db.init(path.join(__dirname, '..', 'data', 'biolab.db'));
      if (db.runMigrations) await db.runMigrations();
      await generateSitemap();
      await db.close();
    } catch (error) {
      console.error('[Sitemap] ❌ Ошибка:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { generateSitemap };
