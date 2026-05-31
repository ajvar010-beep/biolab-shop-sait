// admin/js/settings.js — управление настройками сайта

(async function () {
  const ok = await window.adminAuth.requireAuth();
  if (!ok) return;

  const username = window.adminAuth.getUsername();
  const usernameEl = document.getElementById('adminUsername');
  if (usernameEl) usernameEl.textContent = username;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.adminAuth.logout();
    });
  }

  const container = document.getElementById('settingsContainer');
  const formTemplate = document.getElementById('settingsFormTemplate');
  const socialTemplate = document.getElementById('socialRowTemplate');

  function showError(msg) {
    container.innerHTML = '';
    const p = document.createElement('p');
    p.style.color = 'var(--danger)';
    p.style.padding = '20px';
    p.textContent = msg;
    container.appendChild(p);
  }

  function showMessage(text, kind) {
    const box = document.getElementById('formMessage');
    if (!box) return;
    box.textContent = text;
    box.style.display = 'block';
    box.style.padding = '12px 16px';
    box.style.borderRadius = '8px';
    box.style.background = kind === 'error' ? '#fee' : '#efe';
    box.style.color = kind === 'error' ? '#c33' : '#272';
    box.style.border = `1px solid ${kind === 'error' ? '#fcc' : '#cfc'}`;
    setTimeout(() => { box.style.display = 'none'; }, 4000);
  }

  function addSocialRow(platform, url, label) {
    const list = document.getElementById('socialsList');
    if (!list) return;
    const node = socialTemplate.content.cloneNode(true);
    const platformSel = node.querySelector('.social-platform');
    const urlInput = node.querySelector('.social-url');
    const labelInput = node.querySelector('.social-label');
    const removeBtn = node.querySelector('.social-remove');

    if (platform) platformSel.value = platform;
    if (url) urlInput.value = url;
    if (label) labelInput.value = label;

    removeBtn.addEventListener('click', () => {
      removeBtn.closest('.social-row').remove();
    });

    list.appendChild(node);
  }

  function collectFormData() {
    const socials = [];
    document.querySelectorAll('#socialsList .social-row').forEach((row) => {
      const platform = row.querySelector('.social-platform').value.trim();
      const url = row.querySelector('.social-url').value.trim();
      const label = row.querySelector('.social-label').value.trim();
      if (platform && url) socials.push({ platform, url, label });
    });

    return {
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      workingHours: document.getElementById('workingHours').value.trim(),
      aboutText: document.getElementById('aboutText').value.trim(),
      socials
    };
  }

  function fillForm(data) {
    document.getElementById('email').value = data.email || '';
    document.getElementById('phone').value = data.phone || '';
    document.getElementById('address').value = data.address || '';
    document.getElementById('workingHours').value = data.workingHours || '';
    document.getElementById('aboutText').value = data.aboutText || '';

    const list = document.getElementById('socialsList');
    if (list) list.innerHTML = '';

    if (Array.isArray(data.socials) && data.socials.length) {
      data.socials.forEach((s) => addSocialRow(s.platform, s.url, s.label));
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Не удалось загрузить настройки');
      const data = await res.json();

      // Рендерим форму из template
      container.innerHTML = '';
      container.appendChild(formTemplate.content.cloneNode(true));

      fillForm(data);

      const addBtn = document.getElementById('addSocialBtn');
      if (addBtn) addBtn.addEventListener('click', () => addSocialRow('', '', ''));

      const form = document.getElementById('settingsForm');
      if (form) form.addEventListener('submit', onSubmit);
    } catch (err) {
      console.error(err);
      showError('Не удалось загрузить настройки. Попробуйте обновить страницу.');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохраняю...'; }

    try {
      const data = collectFormData();
      const res = await window.adminAuth.apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || 'Ошибка сохранения');
      showMessage('Сохранено. Изменения уже видны на сайте.', 'ok');
    } catch (err) {
      console.error(err);
      showMessage(err.message || 'Не удалось сохранить', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Сохранить'; }
    }
  }

  loadSettings();
})();
