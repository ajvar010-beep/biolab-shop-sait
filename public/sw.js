/**
 * Service Worker для Biolab Shop
 * Cache-first для статики, network-first для API
 */
const CACHE_NAME = 'biolab-v2';
const STATIC_CACHE = 'biolab-static-v2';
const OFFLINE_URL = '/offline.html';

// Файлы для кэширования при установке
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/assets/css/main.css',
  '/assets/css/shop.css'
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

// Активация — очищаем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE)
            .map(key => {
              console.log('[SW] Удаляем старый кэш:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Пропускаем не-GET и внешние запросы
  if (event.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.host)) return;

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
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
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
