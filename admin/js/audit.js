// История действий (журнал). Доступно ур.2+ (ур.2 видит ур.1; ур.3 — ур.1 и 2).
(async function () {
    'use strict';
    const { requireLevelOrRedirect, apiRequest, logout, getUsername, applyLevelGating } = window.adminAuth;
    const { el, clear, toast, confirmDialog, formatDateTime } = window.adminUI;

    if (!(await requireLevelOrRedirect(2))) return;
    document.getElementById('adminUsername').textContent = getUsername();
    applyLevelGating();

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    const LEVEL_NAMES = { 1: 'Админ', 2: 'Менеджер', 3: 'Владелец' };

    // Человекочитаемый текст действия. targetLabel подставляется отдельной колонкой.
    const ACTION_TEXT = {
        'product.create': 'Добавил товар',
        'product.update': 'Изменил товар',
        'product.delete': 'Удалил товар',
        'order.complete': 'Выдал заказ',
        'order.cancel': 'Отменил заказ',
        'settings.update': 'Изменил настройки магазина',
        'category.create': 'Создал категорию',
        'category.delete': 'Удалил категорию',
        'admin.create': 'Создал аккаунт',
        'admin.delete': 'Удалил аккаунт',
        'admin.password': 'Сменил пароль аккаунту',
        'admin.level': 'Изменил уровень аккаунта',
        'admin.rename': 'Переименовал аккаунт',
        'admin.logout': 'Сбросил сессии аккаунта',
        'admin.self_password': 'Сменил свой пароль'
    };

    // Короткое описание деталей (например, изменение цены).
    function describeDetails(action, details) {
        if (!details) return '';
        let d = details;
        if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (_) { return ''; }
        }
        if (!d || typeof d !== 'object') return '';

        if (action === 'product.update') {
            const parts = [];
            if (d.price) parts.push(`цена: ${d.price.from} → ${d.price.to} ₽`);
            if (d.salePrice) parts.push(`акция: ${d.salePrice.from ?? '—'} → ${d.salePrice.to ?? '—'}`);
            if (d.stock) parts.push(`остаток: ${d.stock.from} → ${d.stock.to}`);
            if (d.category) parts.push(`категория: ${d.category.from} → ${d.category.to}`);
            if (d.title) parts.push('изменено название');
            if (d.description) parts.push('изменено описание');
            if (d.image) parts.push('заменено фото');
            return parts.join(', ');
        }
        if (action === 'admin.create') return `уровень ${d.level}`;
        if (action === 'admin.level') return `уровень ${d.from} → ${d.to}`;
        if (action === 'admin.rename') return `${d.from} → ${d.to}`;
        if (action === 'order.cancel' && d.reason) return `причина: ${d.reason}`;
        return '';
    }

    const container = document.getElementById('auditContainer');

    async function load() {
        try {
            const res = await apiRequest('/audit?limit=300');
            const data = await res.json();
            render(Array.isArray(data.entries) ? data.entries : []);
        } catch (e) {
            clear(container);
            container.appendChild(el('div', { class: 'error-message', text: 'Ошибка загрузки истории' }));
        }
    }

    function render(entries) {
        clear(container);
        if (entries.length === 0) {
            container.appendChild(el('div', { class: 'empty-state' }, [
                el('div', { class: 'empty-state-icon', text: '📜' }),
                el('h3', { text: 'Пока нет записей' }),
                el('p', { text: 'Действия администраторов нижних уровней появятся здесь' })
            ]));
            return;
        }

        const table = el('table');
        const thead = el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Дата и время' }),
                el('th', { text: 'Кто' }),
                el('th', { text: 'Действие' }),
                el('th', { text: 'Объект' }),
                el('th', { text: 'Детали' })
            ])
        ]);
        const tbody = el('tbody');
        for (const e of entries) {
            const actorLevel = Number(e.actorLevel) || 0;
            const who = `${e.actorName || '—'} (${LEVEL_NAMES[actorLevel] || 'ур.' + actorLevel})`;
            tbody.appendChild(el('tr', {}, [
                el('td', { text: formatDateTime(e.createdAt) }),
                el('td', { text: who }),
                el('td', { text: ACTION_TEXT[e.action] || e.action }),
                el('td', { text: e.targetLabel || '' }),
                el('td', { text: describeDetails(e.action, e.details) })
            ]));
        }
        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(el('div', { class: 'table-container' }, [table]));
    }

    await load();
})();
