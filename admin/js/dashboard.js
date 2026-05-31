// Главная панель админки
(async function () {
    'use strict';
    const { requireAuth, apiRequest, logout, getUsername } = window.adminAuth;
    const { el, clear, safeImageUrl, toast, confirmDialog, formatDate } = window.adminUI;

    if (!(await requireAuth())) return;

    document.getElementById('adminUsername').textContent = getUsername();

    document.getElementById('currentDate').textContent =
        new Date().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    const STATUS_TEXT = { pending: 'Ожидает', completed: 'Выдан', cancelled: 'Отменён' };

    async function loadStats() {
        try {
            const [productsRes, ordersRes] = await Promise.all([
                apiRequest('/products'),
                apiRequest('/orders?limit=500')
            ]);
            const products = await productsRes.json();
            const ordersData = await ordersRes.json();
            const orders = Array.isArray(ordersData) ? ordersData : (ordersData.orders || []);

            document.getElementById('totalProducts').textContent = String(products.length);
            document.getElementById('totalOrders').textContent = String(orders.length);
            document.getElementById('pendingOrders').textContent = String(orders.filter(o => o.status === 'pending').length);
            document.getElementById('completedOrders').textContent = String(orders.filter(o => o.status === 'completed').length);

            renderRecentOrders(orders.slice(0, 5));
            renderLowStock(products.filter(p => p.stock < 5).slice(0, 10));
        } catch (error) {
            toast('Ошибка загрузки статистики', 'error');
            console.error(error);
        }
    }

    function renderRecentOrders(orders) {
        const container = document.getElementById('recentOrdersContainer');
        clear(container);

        if (orders.length === 0) {
            container.appendChild(el('div', { class: 'empty-state' }, [el('p', { text: 'Заказов пока нет' })]));
            return;
        }

        const table = el('table');
        const thead = el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Номер' }),
                el('th', { text: 'Клиент' }),
                el('th', { text: 'Товары' }),
                el('th', { text: 'Сумма' }),
                el('th', { text: 'Статус' }),
                el('th', { text: 'Дата' })
            ])
        ]);
        const tbody = el('tbody');
        for (const o of orders) {
            const tr = el('tr', {}, [
                el('td', {}, [el('strong', { text: o.orderCode || '' })]),
                el('td', { text: o.customerName || '' }),
                el('td', { text: `${(o.items || []).length} шт.` }),
                el('td', { text: `${o.totalAmount || 0} ₽` }),
                el('td', {}, [
                    el('span', {
                        class: `badge badge-${o.status}`,
                        text: STATUS_TEXT[o.status] || o.status
                    })
                ]),
                el('td', { text: formatDate(o.createdAt) })
            ]);
            tbody.appendChild(tr);
        }
        table.appendChild(thead);
        table.appendChild(tbody);

        const wrap = el('div', { class: 'table-container' }, [table]);
        container.appendChild(wrap);
    }

    function renderLowStock(products) {
        const container = document.getElementById('lowStockContainer');
        clear(container);

        if (products.length === 0) {
            container.appendChild(el('div', { class: 'empty-state' }, [el('p', { text: 'Все товары в наличии' })]));
            return;
        }

        const table = el('table');
        const thead = el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Изображение' }),
                el('th', { text: 'Название' }),
                el('th', { text: 'Категория' }),
                el('th', { text: 'Остаток' }),
                el('th', { text: 'Цена' })
            ])
        ]);
        const tbody = el('tbody');
        for (const p of products) {
            const imgUrl = safeImageUrl(p.imageUrl);
            const imgCell = el('td');
            if (imgUrl) {
                imgCell.appendChild(el('img', { src: imgUrl, class: 'product-image', alt: p.title || '' }));
            } else {
                imgCell.appendChild(document.createTextNode('🌿'));
            }
            const stockColor = p.stock === 0 ? 'red' : 'orange';
            const tr = el('tr', {}, [
                imgCell,
                el('td', {}, [el('strong', { text: p.title || '' })]),
                el('td', { text: p.category || '' }),
                el('td', {}, [
                    el('span', {
                        style: { color: stockColor, fontWeight: 'bold' },
                        text: String(p.stock)
                    })
                ]),
                el('td', { text: `${p.price} ₽` })
            ]);
            tbody.appendChild(tr);
        }
        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(el('div', { class: 'table-container' }, [table]));
    }

    loadStats();
})();
