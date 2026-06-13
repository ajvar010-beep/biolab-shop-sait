/**
 * Biolab main.js — vanilla JS
 * Phantom by HTML5 UP | html5up.net | CCA 3.0
 */

// Service Worker registration (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err.message));
  });
}

// Play initial animations on page load.
window.addEventListener('load', () => {
  setTimeout(() => document.body.classList.remove('is-preload'), 100);
});

// Touch detection
if ('ontouchstart' in window) document.body.classList.add('is-touch');

// Menu
const menu = document.getElementById('menu');
if (menu) {
  let menuLocked = false;

  // Wrap inner content
  const inner = document.createElement('div');
  inner.className = 'inner';
  while (menu.firstChild) inner.appendChild(menu.firstChild);
  menu.appendChild(inner);

  // Переносим меню прямо в <body>. Иначе оно остаётся внутри #wrapper, который
  // при открытом меню получает pointer-events:none + opacity:0.25 — и пункты
  // меню становятся некликабельными и полупрозрачными. (Поведение шаблона Phantom.)
  document.body.appendChild(menu);

  function lockMenu() {
    if (menuLocked) return false;
    menuLocked = true;
    setTimeout(() => { menuLocked = false; }, 350);
    return true;
  }

  function showMenu() {
    if (lockMenu()) document.body.classList.add('is-menu-visible');
  }

  function hideMenu() {
    if (lockMenu()) document.body.classList.remove('is-menu-visible');
  }

  function toggleMenu() {
    if (lockMenu()) document.body.classList.toggle('is-menu-visible');
  }

  // Close button
  const closeBtn = document.createElement('a');
  closeBtn.className = 'close';
  closeBtn.href = '#menu';
  closeBtn.textContent = 'Close';
  menu.appendChild(closeBtn);

  closeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    hideMenu();
  });

  // Click on menu links
  // Без stopPropagation: иначе клики не доходят до document-слушателей theme.js
  // (переключатели темы/шрифта). Закрытие по клику мимо меню само игнорирует #menu.
  menu.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    // Переключатели темы/размера шрифта обрабатывает theme.js — меню не закрываем
    if (link.matches('[data-theme-set], [data-fontsize-set]')) return;
    e.preventDefault();
    hideMenu();
    const href = link.getAttribute('href');
    if (href && href !== '#menu' && href !== '#') {
      setTimeout(() => { window.location.href = href; }, 350);
    }
  });

  // Body click — hide menu.
  // Важно: пропускаем клики по кнопке-открывашке a[href="#menu"] — её обрабатывает
  // toggle-слушатель ниже. Оба слушателя висят на document, и stopPropagation
  // не останавливает соседние обработчики на том же узле: без этой проверки
  // hideMenu() срабатывал первым и блокировал toggleMenu() (меню не открывалось).
  document.addEventListener('click', e => {
    if (!document.body.classList.contains('is-menu-visible')) return;
    if (e.target.closest('#menu')) return;
    if (e.target.closest('a[href="#menu"]')) return;
    hideMenu();
  });

  // Toggle links
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href="#menu"]');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideMenu();
  });
}
