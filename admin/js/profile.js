// Профиль: показ своего уровня + смена своего пароля
(async function () {
    'use strict';
    const { requireAuth, apiRequest, logout, getUsername, getLevel, applyLevelGating } = window.adminAuth;
    const { toast, confirmDialog } = window.adminUI;

    if (!(await requireAuth())) return;
    document.getElementById('adminUsername').textContent = getUsername();
    applyLevelGating();

    const LEVEL_NAMES = { 1: 'Обычный администратор', 2: 'Менеджер', 3: 'Владелец' };

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    document.getElementById('profileUsername').textContent = getUsername();
    const lvl = getLevel();
    document.getElementById('profileLevel').textContent = `${LEVEL_NAMES[lvl] || '—'} (уровень ${lvl})`;

    const form = document.getElementById('passwordForm');
    const formMessage = document.getElementById('formMessage');
    const saveBtn = document.getElementById('saveBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formMessage.style.display = 'none';

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;

        if (!currentPassword || newPassword.length < 8) {
            formMessage.textContent = 'Заполните текущий пароль и новый (минимум 8 символов)';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';

        try {
            const res = await apiRequest('/admins/me/password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast('Пароль изменён. Войдите заново.', 'success');
                // Пароль сменён — серверный tokenVersion увеличен, текущий токен инвалиден.
                setTimeout(() => logout(), 1500);
            } else {
                formMessage.textContent = data.message || 'Ошибка смены пароля';
                formMessage.className = 'error-message';
                formMessage.style.display = 'block';
            }
        } catch (err) {
            formMessage.textContent = 'Ошибка сети';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Сменить пароль';
        }
    });
})();
