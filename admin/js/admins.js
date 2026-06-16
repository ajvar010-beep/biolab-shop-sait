// Управление администраторами. Доступно ур.2+ (управление ур.1), создание/уровни — ур.3.
(async function () {
    'use strict';
    const { requireLevelOrRedirect, apiRequest, logout, getUsername, getLevel, applyLevelGating } = window.adminAuth;
    const { el, clear, toast, confirmDialog } = window.adminUI;

    if (!(await requireLevelOrRedirect(2))) return;
    document.getElementById('adminUsername').textContent = getUsername();
    applyLevelGating();

    const myLevel = getLevel();
    const LEVEL_NAMES = { 1: 'Обычный администратор', 2: 'Менеджер', 3: 'Владелец' };

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    const container = document.getElementById('adminsContainer');
    const modal = document.getElementById('adminModal');
    const form = document.getElementById('adminForm');
    const addBtn = document.getElementById('addAdminBtn');
    const closeBtn = document.getElementById('closeAdminModal');
    const cancelBtn = document.getElementById('cancelAdminBtn');
    const levelSelect = document.getElementById('newAdminLevel');
    const formMessage = document.getElementById('adminFormMessage');
    const submitBtn = document.getElementById('submitAdminBtn');

    // В селект уровней — только уровни СТРОГО НИЖЕ своего.
    for (let lvl = 1; lvl < myLevel; lvl++) {
        levelSelect.add(new Option(`${lvl} — ${LEVEL_NAMES[lvl]}`, String(lvl)));
    }

    function openModal() {
        form.reset();
        formMessage.style.display = 'none';
        modal.classList.add('active');
    }
    function closeModal() { modal.classList.remove('active'); }

    if (addBtn) addBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

    async function load() {
        try {
            const res = await apiRequest('/admins');
            const data = await res.json();
            render(Array.isArray(data.admins) ? data.admins : []);
        } catch (e) {
            clear(container);
            container.appendChild(el('div', { class: 'error-message', text: 'Ошибка загрузки списка' }));
        }
    }

    function render(admins) {
        clear(container);
        if (admins.length === 0) {
            container.appendChild(el('div', { class: 'empty-state' }, [
                el('h3', { text: 'Нет управляемых аккаунтов' })
            ]));
            return;
        }

        const table = el('table');
        table.appendChild(el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Логин' }),
                el('th', { text: 'Уровень' }),
                el('th', { text: 'Действия' })
            ])
        ]));
        const tbody = el('tbody');
        for (const a of admins) {
            tbody.appendChild(renderRow(a));
        }
        table.appendChild(tbody);
        container.appendChild(el('div', { class: 'table-container' }, [table]));
    }

    function renderRow(a) {
        const isSelf = !!a.self;
        const canManage = !isSelf && a.level < myLevel;

        const nameCell = el('td', {}, [
            el('strong', { text: a.username }),
            isSelf ? el('span', { style: { color: '#999', marginLeft: '6px' }, text: '(вы)' }) : null
        ]);

        const actions = el('div', { class: 'actions', style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });

        if (canManage) {
            // Сменить пароль (ур.2+)
            const pwBtn = el('button', { class: 'btn btn-secondary btn-small', type: 'button', text: '🔑 Пароль' });
            pwBtn.addEventListener('click', () => onSetPassword(a));
            actions.appendChild(pwBtn);

            // Выгнать — сбросить сессии (ур.2+)
            const kickBtn = el('button', { class: 'btn btn-secondary btn-small', type: 'button', text: '🚪 Выгнать' });
            kickBtn.addEventListener('click', () => onForceLogout(a));
            actions.appendChild(kickBtn);

            // Сменить уровень + переименовать — только ур.3
            if (myLevel >= 3) {
                const lvlBtn = el('button', { class: 'btn btn-secondary btn-small', type: 'button', text: '🎚 Уровень' });
                lvlBtn.addEventListener('click', () => onSetLevel(a));
                actions.appendChild(lvlBtn);

                const renameBtn = el('button', { class: 'btn btn-secondary btn-small', type: 'button', text: '✏️ Логин' });
                renameBtn.addEventListener('click', () => onRename(a));
                actions.appendChild(renameBtn);
            }

            // Удалить аккаунт (забрать админку) — ур.2+
            const delBtn = el('button', { class: 'btn btn-danger btn-small', type: 'button', text: '🗑 Удалить' });
            delBtn.addEventListener('click', () => onDelete(a));
            actions.appendChild(delBtn);
        } else {
            actions.appendChild(el('span', { style: { color: '#999' }, text: '—' }));
        }

        return el('tr', {}, [
            nameCell,
            el('td', { text: `${a.level} — ${LEVEL_NAMES[a.level] || ''}` }),
            el('td', {}, [actions])
        ]);
    }

    // ===== Действия =====

    async function doRequest(path, options, okMsg) {
        try {
            const res = await apiRequest(path, options);
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast(okMsg, 'success');
                await load();
                return true;
            }
            toast(data.message || 'Ошибка', 'error');
        } catch (e) {
            toast('Ошибка сети', 'error');
        }
        return false;
    }

    async function onSetPassword(a) {
        const password = prompt(`Новый пароль для «${a.username}» (минимум 8 символов):`);
        if (password == null) return;
        if (password.length < 8) { toast('Пароль: минимум 8 символов', 'error'); return; }
        await doRequest(`/admins/${encodeURIComponent(a.id)}/password`, {
            method: 'PUT', body: JSON.stringify({ password })
        }, 'Пароль изменён');
    }

    async function onForceLogout(a) {
        if (!await confirmDialog({
            title: 'Выгнать из аккаунта',
            message: `Сбросить активные сессии «${a.username}»? Он будет вынужден войти заново.`,
            confirmText: 'Выгнать', danger: true
        })) return;
        await doRequest(`/admins/${encodeURIComponent(a.id)}/logout`, { method: 'POST' }, 'Сессии сброшены');
    }

    async function onSetLevel(a) {
        const options = [];
        for (let lvl = 1; lvl < myLevel; lvl++) options.push(`${lvl} — ${LEVEL_NAMES[lvl]}`);
        const raw = prompt(`Новый уровень для «${a.username}» (доступно: 1..${myLevel - 1}):\n${options.join('\n')}`, String(a.level));
        if (raw == null) return;
        const level = parseInt(raw, 10);
        if (!(level >= 1 && level < myLevel)) { toast(`Уровень должен быть от 1 до ${myLevel - 1}`, 'error'); return; }
        await doRequest(`/admins/${encodeURIComponent(a.id)}/level`, {
            method: 'PUT', body: JSON.stringify({ level })
        }, 'Уровень изменён');
    }

    async function onRename(a) {
        const username = prompt(`Новый логин для «${a.username}»:`, a.username);
        if (username == null) return;
        await doRequest(`/admins/${encodeURIComponent(a.id)}/username`, {
            method: 'PUT', body: JSON.stringify({ username })
        }, 'Логин изменён');
    }

    async function onDelete(a) {
        if (!await confirmDialog({
            title: 'Удалить аккаунт',
            message: `Удалить аккаунт «${a.username}»? Действие необратимо — доступ будет отозван.`,
            confirmText: 'Удалить', danger: true
        })) return;
        await doRequest(`/admins/${encodeURIComponent(a.id)}`, { method: 'DELETE' }, 'Аккаунт удалён');
    }

    // ===== Создание (ур.3) =====
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formMessage.style.display = 'none';

        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newAdminPassword').value;
        const level = parseInt(levelSelect.value, 10);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Создание...';
        try {
            const res = await apiRequest('/admins', {
                method: 'POST', body: JSON.stringify({ username, password, level })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                closeModal();
                toast('Аккаунт создан', 'success');
                await load();
            } else {
                formMessage.textContent = data.message || 'Ошибка создания';
                formMessage.className = 'error-message';
                formMessage.style.display = 'block';
            }
        } catch (err) {
            formMessage.textContent = 'Ошибка сети';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Создать';
        }
    });

    await load();
})();
