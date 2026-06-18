// Безопасные UI-хелперы для админки.
// Главная цель — никаких innerHTML с пользовательскими данными.
// Всё через createElement + textContent + setAttribute.

(function () {
  'use strict';

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'class' || k === 'className') {
        node.className = v;
      } else if (k === 'text') {
        node.textContent = String(v);
      } else if (k === 'dataset' && typeof v === 'object') {
        for (const [dk, dv] of Object.entries(v)) {
          if (dv != null) node.dataset[dk] = String(dv);
        }
      } else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sv != null) node.style[sk] = String(sv);
        }
      } else if (k.startsWith('on')) {
        // только функции-обработчики; строковые on*-атрибуты игнорируем (защита от XSS)
        if (typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (/^(href|src|xlink:href|formaction|action)$/i.test(k)) {
        // блокируем javascript:/vbscript:/data: в URL-атрибутах
        if (!/^\s*(javascript|vbscript|data):/i.test(String(v))) node.setAttribute(k, String(v));
      } else {
        node.setAttribute(k, String(v));
      }
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
      if (child == null || child === false) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Безопасный URL изображения (только http/https и относительные /uploads/)
  function safeImageUrl(url) {
    if (typeof url !== 'string' || !url) return '';
    if (url.startsWith('/uploads/') || url.startsWith('/images/')) return url;
    try {
      const u = new URL(url, window.location.origin);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch (_) {}
    return '';
  }

  // ===== Тосты вместо alert =====
  function ensureToastContainer() {
    let c = document.getElementById('admin-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'admin-toast-container';
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = 'info') {
    const c = ensureToastContainer();
    const colors = {
      info: '#1e88e5',
      success: '#2ed573',
      error: '#ff4757',
      warning: '#ffa502'
    };
    const node = el('div', {
      class: 'admin-toast',
      style: {
        background: colors[type] || colors.info,
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,.2)',
        maxWidth: '360px',
        opacity: '0',
        transform: 'translateX(20px)',
        transition: 'opacity .25s ease, transform .25s ease'
      },
      text: String(message)
    });
    c.appendChild(node);
    requestAnimationFrame(() => {
      node.style.opacity = '1';
      node.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateX(20px)';
      setTimeout(() => node.remove(), 300);
    }, 3500);
  }

  // ===== Подтверждение через модалку =====
  function confirmDialog({ title = 'Подтверждение', message = '', confirmText = 'OK', cancelText = 'Отмена', danger = false } = {}) {
    return new Promise((resolve) => {
      const overlay = el('div', {
        style: {
          position: 'fixed', inset: '0', background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: '99998'
        }
      });
      const box = el('div', {
        style: {
          background: '#fff', color: '#222', borderRadius: '12px',
          maxWidth: '420px', width: '90%', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,.4)'
        }
      });
      box.appendChild(el('h3', { text: title, style: { margin: '0 0 12px 0' } }));
      box.appendChild(el('p', { text: message, style: { margin: '0 0 16px 0', color: '#444' } }));

      const actions = el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' } });
      const cancel = el('button', {
        type: 'button', text: cancelText,
        style: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' },
        onclick: () => { overlay.remove(); resolve(false); }
      });
      const ok = el('button', {
        type: 'button', text: confirmText,
        style: {
          padding: '8px 16px', borderRadius: '8px', border: 'none',
          background: danger ? '#ff4757' : '#2ed573', color: '#fff', cursor: 'pointer', fontWeight: '600'
        },
        onclick: () => { overlay.remove(); resolve(true); }
      });
      actions.appendChild(cancel);
      actions.appendChild(ok);
      box.appendChild(actions);
      overlay.appendChild(box);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
      document.body.appendChild(overlay);
      setTimeout(() => ok.focus(), 0);
    });
  }

  function debounce(fn, wait = 200) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function formatDateTime(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU');
  }

  window.adminUI = {
    el, clear, safeImageUrl, toast, confirmDialog, debounce, formatDateTime, formatDate
  };
})();
