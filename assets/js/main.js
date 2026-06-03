/**
 * Biolab main.js — vanilla JS
 * Phantom by HTML5 UP | html5up.net | CCA 3.0
 */

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
  menu.addEventListener('click', e => {
    e.stopPropagation();
    const link = e.target.closest('a');
    if (!link) return;
    e.preventDefault();
    hideMenu();
    const href = link.getAttribute('href');
    if (href && href !== '#menu') {
      setTimeout(() => { window.location.href = href; }, 350);
    }
  });

  // Body click — hide menu
  document.addEventListener('click', e => {
    if (e.target.closest('#menu')) return;
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
