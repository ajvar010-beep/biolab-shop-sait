// assets/js/site-settings.js
// Подгружает настройки сайта (контакты, соцсети, текст «о нас») из /api/settings
// и заполняет ими футер. Если сервер не ответил — оставляем дефолтный текст.

(function () {
  // Иконки соцсетей в виде SVG (без сторонних библиотек, чтобы не зависить от CDN)
  const ICONS = {
    vk: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21.547 7.07c.15-.499 0-.864-.713-.864h-2.358c-.6 0-.876.317-1.025.665 0 0-1.2 2.92-2.9 4.819-.55.55-.799.724-1.099.724-.15 0-.367-.174-.367-.673V7.069c0-.598-.173-.864-.673-.864H8.69c-.374 0-.6.276-.6.54 0 .567.847.698.935 2.293v3.46c0 .76-.137.897-.437.897-.799 0-2.745-2.93-3.9-6.284-.227-.65-.453-.913-1.054-.913H1.276c-.674 0-.81.317-.81.665 0 .624.798 3.722 3.722 7.819 1.95 2.798 4.697 4.315 7.197 4.315 1.5 0 1.685-.337 1.685-.916v-2.114c0-.673.142-.807.617-.807.35 0 .949.175 2.348 1.524 1.6 1.6 1.866 2.314 2.764 2.314h2.358c.674 0 1.011-.337.817-.998-.213-.66-.973-1.617-1.98-2.751-.547-.647-1.367-1.343-1.617-1.692-.35-.448-.25-.647 0-1.045 0 0 2.86-4.022 3.16-5.388z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.466.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.473-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    odnoklassniki: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 4.6c2 0 3.6 1.6 3.6 3.6S14 11.8 12 11.8 8.4 10.2 8.4 8.2 10 4.6 12 4.6zm5.4 12.6c-.2.4-.6.6-1 .6-.2 0-.4 0-.6-.2-1.6-1-3.4-1.6-3.8-1.6-.4 0-2.2.6-3.8 1.6-.2.2-.4.2-.6.2-.4 0-.8-.2-1-.6-.4-.6-.2-1.4.4-1.8 1-.6 2.4-1.2 3.6-1.4l-2-2c-.6-.6-.6-1.4 0-2 .6-.6 1.4-.6 2 0l1.6 1.6 1.6-1.6c.6-.6 1.4-.6 2 0 .6.6.6 1.4 0 2l-2 2c1.2.2 2.6.8 3.6 1.4.4.4.6 1.2.2 1.8z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    website: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    email: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    other: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  const PLATFORM_LABELS = {
    vk: 'ВКонтакте',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    odnoklassniki: 'Одноклассники',
    facebook: 'Facebook',
    website: 'Сайт',
    email: 'Email',
    phone: 'Телефон',
    other: 'Ссылка'
  };

  function isSafeHttpUrl(url) {
    if (typeof url !== 'string' || !url) return false;
    if (/^(mailto:|tel:)/i.test(url)) return true;
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function show(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  function setHref(id, href) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('href', href);
  }

  function fillContacts(data) {
    if (data.aboutText) setText('aboutText', data.aboutText);

    if (data.email) {
      setText('emailLink', data.email);
      setHref('emailLink', `mailto:${data.email}`);
      show('contactEmail');
    }

    if (data.phone) {
      setText('phoneLink', data.phone);
      // tel: должен быть без пробелов и скобок
      const telDigits = data.phone.replace(/[^\d+]/g, '');
      setHref('phoneLink', `tel:${telDigits}`);
      show('contactPhone');
    }

    if (data.address) {
      setText('addressText', data.address);
      show('contactAddress');
    }

    if (data.workingHours) {
      setText('hoursText', data.workingHours);
      show('contactHours');
    }
  }

  function fillSocials(socials) {
    if (!Array.isArray(socials) || !socials.length) return;
    const list = document.getElementById('socialsList');
    const section = document.getElementById('socialsSection');
    if (!list || !section) return;

    list.innerHTML = '';
    socials.forEach((s) => {
      if (!s || !s.platform || !isSafeHttpUrl(s.url)) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'social-link';
      a.title = s.label || PLATFORM_LABELS[s.platform] || s.platform;
      a.setAttribute('aria-label', a.title);

      const iconSvg = ICONS[s.platform] || ICONS.other;
      // innerHTML здесь безопасен — иконки наши, пользовательский ввод в них не попадает
      const iconWrap = document.createElement('span');
      iconWrap.className = 'social-icon';
      iconWrap.innerHTML = iconSvg;
      a.appendChild(iconWrap);

      if (s.label) {
        const lbl = document.createElement('span');
        lbl.className = 'social-label';
        lbl.textContent = s.label;
        a.appendChild(lbl);
      }

      li.appendChild(a);
      list.appendChild(li);
    });

    if (list.children.length > 0) section.style.display = '';
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      fillContacts(data);
      fillSocials(data.socials);
    } catch (_) {
      // Тихо: дефолтный текст в HTML и так показан
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
  } else {
    loadSettings();
  }
})();
