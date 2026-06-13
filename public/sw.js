/**
 * Service Worker для Biolab Shop
 * Cache-first для статики, network-first для API
 */
const CACHE_NAME = 'biolab-v9';
const STATIC_CACHE = 'biolab-static-v9';
const OFFLINE_URL = '/offline.html';

// Файлы для кэширования при установке.
// offline.html обязателен — иначе HTML-fallback в офлайне отдаёт пустоту.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/assets/css/main.css',
  '/assets/css/shop.css',
  '/assets/css/botanical.css'
];

// Установка — кэшируем статику
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Кэшируем статику...');
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.warn('[SW] Не удалось закэшировать все файлы:', err.message);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация — очищаем ТОЛЬКО устаревшие кэши.
// Оставляем оба актуальных (STATIC_CACHE и CACHE_NAME), иначе при апдейте SW
// мы бы стирали собственный рантайм-кэш HTML-страниц.
self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => !keep.includes(key))
            .map(key => {
              console.log('[SW] Удаляем старый кэш:', key);
              return caches.delete(key);
            })
      ))
      .then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Пропускаем не-GET и внешние запросы.
  // Сравниваем origin строго (== self.location.origin), а не подстрокой:
  // includes() пропускал бы чужой домен вида "biolab-shop-sait.onrender.com.evil.com".
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API-запросы — network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request).then(cached => {
            return cached || new Response(
              JSON.stringify({ message: 'Нет соединения' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Статика (CSS, JS, шрифты, картинки) — cache-first
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg')
  ) {
    // stale-while-revalidate: мгновенно отдаём из кэша, но в фоне обновляем,
    // чтобы после деплоя статика с тем же именем не залипала навсегда.
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // HTML-страницы — network-first с fallback на кэш или offline
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Всё остальное — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
