// Логика тем и размеров шрифта (вынесено из inline <script> ради CSP)

(function () {
  function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    try { localStorage.setItem('siteTheme', themeName); } catch (_) {}
  }

  function setFontSize(size) {
    document.documentElement.setAttribute('data-fontsize', size);
    try { localStorage.setItem('siteFontSize', size); } catch (_) {}
  }

  // Применяем сохранённые настройки до DOMContentLoaded, чтобы не было мерцания.
  // Дефолт — светлая (ботаническая) тема.
  try { setTheme(localStorage.getItem('siteTheme') || 'light'); } catch (_) { setTheme('light'); }
  try { setFontSize(localStorage.getItem('siteFontSize') || 'normal'); } catch (_) { setFontSize('normal'); }

  // Делегированные обработчики для переключателей.
  // ВАЖНО: capture phase (третий аргумент true) — иначе main.js шаблона
  // успевает остановить событие раньше, чем оно дойдёт сюда в bubbling.
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-theme-set], [data-fontsize-set]');
    if (!target) return;
    if (target.dataset.themeSet) {
      setTheme(target.dataset.themeSet);
      event.preventDefault();
      event.stopPropagation();
    }
    if (target.dataset.fontsizeSet) {
      setFontSize(target.dataset.fontsizeSet);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Экспортируем на случай, если что-то ещё вызывает их по имени
  window.setTheme = setTheme;
  window.setFontSize = setFontSize;
})();
