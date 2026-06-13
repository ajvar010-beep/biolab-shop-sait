// Управление заказами
(async function () {
    'use strict';
    const { requireAuth, apiRequest, logout, getUsername } = window.adminAuth;
    const { el, clear, toast, confirmDialog, debounce, formatDateTime } = window.adminUI;

    if (!(await requireAuth())) return;
    document.getElementById('adminUsername').textContent = getUsername();

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    let orders = [];
    let currentOrder = null;
    let refreshTimer = null;

    const ordersContainer = document.getElementById('ordersContainer');
    const orderModal = document.getElementById('orderModal');
    const qrScanModal = document.getElementById('qrScanModal');
    const qrManualModal = document.getElementById('qrManualModal');
    const closeModal = document.getElementById('closeModal');
    const closeQrModal = document.getElementById('closeQrModal');
    const closeQrManualModal = document.getElementById('closeQrManualModal');
    const scanQrBtn = document.getElementById('scanQrBtn');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');

    const STATUS_TEXT = { pending: 'Ожидает', completed: 'Выдан', cancelled: 'Отменён' };

    let ordersTruncated = false;

    async function loadOrders() {
        try {
            const response = await apiRequest('/orders?limit=500');
            const data = await response.json();
            orders = Array.isArray(data) ? data : (data.orders || []);
            // Сервер отдаёт максимум 500. Если всего заказов больше — честно говорим,
            // что список обрезан (иначе старые заказы молча не видны).
            const total = (data && typeof data.total === 'number') ? data.total : orders.length;
            ordersTruncated = total > orders.length;
            orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            filterAndDisplay();
        } catch (error) {
            clear(ordersContainer);
            ordersContainer.appendChild(el('div', { class: 'error-message', text: 'Ошибка загрузки заказов' }));
        }
    }

    function filterAndDisplay() {
        const status = statusFilter.value;
        const search = searchInput.value.toLowerCase().trim();
        let list = orders;
        if (status) list = list.filter(o => o.status === status);
        if (search) {
            list = list.filter(o =>
                String(o.orderCode || '').toLowerCase().includes(search) ||
                String(o.customerName || '').toLowerCase().includes(search) ||
                String(o.customerPhone || '').includes(search)
            );
        }
        displayOrders(list);
    }

    function displayOrders(list) {
        clear(ordersContainer);
        if (list.length === 0) {
            ordersContainer.appendChild(el('div', { class: 'empty-state' }, [
                el('div', { class: 'empty-state-icon', text: '📦' }),
                el('h3', { text: 'Заказов пока нет' }),
                el('p', { text: 'Когда клиенты начнут делать заказы, они появятся здесь' })
            ]));
            return;
        }

        const table = el('table');
        const thead = el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Номер' }),
                el('th', { text: 'Дата' }),
                el('th', { text: 'Клиент' }),
                el('th', { text: 'Телефон' }),
                el('th', { text: 'Товары' }),
                el('th', { text: 'Сумма' }),
                el('th', { text: 'Статус' }),
                el('th', { text: 'Действия' })
            ])
        ]);
        const tbody = el('tbody');

        for (const order of list) {
            const viewBtn = el('button', { class: 'btn btn-secondary btn-small', type: 'button', 'aria-label': 'Просмотр', text: '👁️' });
            viewBtn.addEventListener('click', () => viewOrder(order.orderCode));

            const actions = el('div', { class: 'actions' }, [viewBtn]);
            if (order.status === 'pending') {
                const completeBtn = el('button', { class: 'btn btn-primary btn-small', type: 'button', 'aria-label': 'Выдать', text: '✅' });
                completeBtn.addEventListener('click', () => completeOrder(order.orderCode));
                const cancelBtn = el('button', { class: 'btn btn-danger btn-small', type: 'button', 'aria-label': 'Отменить', text: '❌' });
                cancelBtn.addEventListener('click', () => cancelOrder(order.orderCode));
                actions.appendChild(completeBtn);
                actions.appendChild(cancelBtn);
            }

            const tr = el('tr', {}, [
                el('td', {}, [el('strong', { text: order.orderCode || '' })]),
                el('td', { text: formatDateTime(order.createdAt) }),
                el('td', { text: order.customerName || '' }),
                el('td', { text: order.customerPhone || '' }),
                // Сумма штук по всем позициям, а не число позиций
                el('td', { text: `${(order.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)} шт.` }),
                el('td', {}, [el('strong', { text: `${order.totalAmount || 0} ₽` })]),
                el('td', {}, [
                    el('span', { class: `badge badge-${order.status}`, text: STATUS_TEXT[order.status] || order.status })
                ]),
                el('td', {}, [actions])
            ]);
            tbody.appendChild(tr);
        }
        table.appendChild(thead);
        table.appendChild(tbody);
        ordersContainer.appendChild(el('div', { class: 'table-container' }, [table]));

        if (ordersTruncated) {
            ordersContainer.appendChild(el('div', {
                class: 'error-message',
                style: { marginTop: '12px' },
                text: 'Показаны последние 500 заказов. Более старые скрыты — используйте поиск по коду или телефону.'
            }));
        }
    }

    async function viewOrder(orderCode) {
        try {
            const response = await apiRequest(`/orders/admin/code/${encodeURIComponent(orderCode)}`);
            if (!response.ok) {
                toast('Не удалось загрузить заказ', 'error');
                return;
            }
            currentOrder = await response.json();
            renderOrderDetails(currentOrder);
            orderModal.classList.add('active');
        } catch (e) {
            toast('Ошибка загрузки заказа', 'error');
        }
    }

    function renderOrderDetails(order) {
        document.getElementById('modalOrderNumber').textContent = order.orderCode || '';
        const details = document.getElementById('orderDetails');
        clear(details);

        const wrap = el('div', { style: { padding: '20px' } });

        const customerSection = el('div', { style: { marginBottom: '20px' } }, [
            el('h3', { style: { marginBottom: '10px' }, text: 'Информация о клиенте' }),
            el('p', {}, [el('strong', { text: 'Имя: ' }), order.customerName || '']),
            el('p', {}, [el('strong', { text: 'Телефон: ' }), order.customerPhone || '']),
            order.customerEmail
                ? el('p', {}, [el('strong', { text: 'Email: ' }), order.customerEmail])
                : null
        ].filter(Boolean));
        wrap.appendChild(customerSection);

        // Товары
        const itemsTable = el('table', { style: { width: '100%' } });
        itemsTable.appendChild(el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Название' }),
                el('th', { text: 'Кол-во' }),
                el('th', { text: 'Цена' }),
                el('th', { text: 'Сумма' })
            ])
        ]));
        const tbody = el('tbody');
        for (const it of (order.items || [])) {
            tbody.appendChild(el('tr', {}, [
                el('td', { text: it.title || '' }),
                el('td', { text: String(it.quantity) }),
                el('td', { text: `${it.price} ₽` }),
                el('td', {}, [el('strong', { text: `${it.price * it.quantity} ₽` })])
            ]));
        }
        itemsTable.appendChild(tbody);
        itemsTable.appendChild(el('tfoot', {}, [
            el('tr', {}, [
                el('td', { colspan: '3', style: { textAlign: 'right' } }, [el('strong', { text: 'Итого:' })]),
                el('td', {}, [el('strong', { text: `${order.totalAmount || 0} ₽` })])
            ])
        ]));
        wrap.appendChild(el('div', { style: { marginBottom: '20px' } }, [
            el('h3', { style: { marginBottom: '10px' }, text: 'Товары' }),
            itemsTable
        ]));

        // Код заказа
        const codeBox = el('div', {
            style: {
                fontSize: '32px', fontWeight: 'bold', color: '#2ed573',
                letterSpacing: '3px', textAlign: 'center', padding: '20px',
                background: '#f8f9fa', borderRadius: '8px', border: '2px solid #2ed573'
            },
            text: order.orderCode || ''
        });
        wrap.appendChild(el('div', { style: { marginBottom: '20px' } }, [
            el('h3', { style: { marginBottom: '10px' }, text: 'Код заказа' }),
            codeBox,
            el('p', { style: { marginTop: '10px', color: 'var(--text-muted)', textAlign: 'center' }, text: 'Покажите этот код клиенту' })
        ]));

        // Статус
        const statusSection = el('div', { style: { marginBottom: '20px' } }, [
            el('p', {}, [
                el('strong', { text: 'Статус: ' }),
                el('span', { class: `badge badge-${order.status}`, text: STATUS_TEXT[order.status] || order.status })
            ]),
            el('p', {}, [el('strong', { text: 'Дата создания: ' }), formatDateTime(order.createdAt)]),
            order.completedAt ? el('p', {}, [el('strong', { text: 'Дата выдачи: ' }), formatDateTime(order.completedAt)]) : null,
            order.cancelledAt ? el('p', {}, [el('strong', { text: 'Дата отмены: ' }), formatDateTime(order.cancelledAt)]) : null,
            order.cancelReason ? el('p', {}, [el('strong', { text: 'Причина: ' }), order.cancelReason]) : null
        ].filter(Boolean));
        wrap.appendChild(statusSection);

        if (order.status === 'pending') {
            const cancelBtn = el('button', { class: 'btn btn-danger', type: 'button', text: 'Отменить заказ' });
            cancelBtn.addEventListener('click', () => cancelOrder(order.orderCode));
            const completeBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Выдать заказ' });
            completeBtn.addEventListener('click', () => completeOrder(order.orderCode));
            wrap.appendChild(el('div', { class: 'modal-footer' }, [cancelBtn, completeBtn]));
        }

        details.appendChild(wrap);
    }

    async function completeOrder(orderCode) {
        if (!await confirmDialog({
            title: 'Выдать заказ',
            message: `Подтвердите выдачу заказа ${orderCode}`,
            confirmText: 'Выдать'
        })) return;

        try {
            const response = await apiRequest(`/orders/${encodeURIComponent(orderCode)}/complete`, { method: 'POST' });
            if (response.ok) {
                orderModal.classList.remove('active');
                await loadOrders();
                toast('Заказ выдан', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                toast('Ошибка: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            toast('Ошибка обновления заказа', 'error');
        }
    }

    async function cancelOrder(orderCode) {
        const reason = await promptDialog({
            title: 'Отмена заказа',
            message: `Укажите причину отмены заказа ${orderCode}:`,
            confirmText: 'Отменить',
            cancelText: 'Не отменять',
            danger: true
        });
        if (reason === null) return;

        try {
            const response = await apiRequest(`/orders/${encodeURIComponent(orderCode)}/cancel`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            if (response.ok) {
                orderModal.classList.remove('active');
                await loadOrders();
                toast('Заказ отменён', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                toast('Ошибка: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            toast('Ошибка отмены заказа', 'error');
        }
    }

    // Простая prompt-модалка с textarea
    function promptDialog({ title = '', message = '', confirmText = 'OK', cancelText = 'Отмена', danger = false } = {}) {
        return new Promise((resolve) => {
            const overlay = el('div', {
                style: {
                    position: 'fixed', inset: '0', background: 'rgba(0,0,0,.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '99998'
                }
            });
            const ta = el('textarea', {
                rows: '4',
                style: { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }
            });
            const cancel = el('button', {
                type: 'button', text: cancelText,
                style: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer' },
                onclick: () => { overlay.remove(); resolve(null); }
            });
            const ok = el('button', {
                type: 'button', text: confirmText,
                style: {
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: danger ? '#ff4757' : '#2ed573', color: '#fff', cursor: 'pointer', fontWeight: '600'
                },
                onclick: () => { const v = ta.value.trim(); if (!v) { ta.focus(); return; } overlay.remove(); resolve(v); }
            });
            const box = el('div', {
                style: {
                    background: '#fff', color: '#222', borderRadius: '12px', maxWidth: '480px', width: '90%',
                    padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,.4)'
                }
            }, [
                el('h3', { text: title, style: { margin: '0 0 12px 0' } }),
                el('p', { text: message, style: { margin: '0 0 12px 0', color: '#444' } }),
                ta,
                el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' } }, [cancel, ok])
            ]);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            setTimeout(() => ta.focus(), 0);
        });
    }

    // QR Scanner
    let html5QrCode = null;
    let isScanning = false;
    let stopRequested = false; // запрошена остановка, пока камера ещё стартует

    async function startQrScanner() {
        if (isScanning) return;
        stopRequested = false;

        const qrMessage = document.getElementById('qrMessage');
        qrMessage.textContent = 'Запуск камеры...';
        qrMessage.className = '';
        qrMessage.style.display = 'block';

        try {
            html5QrCode = new Html5Qrcode('qr-reader');
            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onQrCodeScanned,
                (errorMessage) => {}
            );
            isScanning = true;
            qrMessage.style.display = 'none';
            // Если модалку закрыли, пока камера стартовала — гасим сразу
            if (stopRequested) await stopQrScanner();
        } catch (err) {
            qrMessage.textContent = 'Не удалось запустить камеру. Проверьте разрешения браузера.';
            qrMessage.className = 'error-message';
            qrMessage.style.display = 'block';
            console.error('QR scanner error:', err);
        }
    }

    async function stopQrScanner() {
        // Помечаем намерение остановиться даже если start() ещё не завершился
        stopRequested = true;
        if (html5QrCode && isScanning) {
            try { await html5QrCode.stop(); } catch (e) {}
            try { html5QrCode.clear(); } catch (e) {}
            isScanning = false;
        }
    }

    async function onQrCodeScanned(decodedText) {
        if (navigator.vibrate) navigator.vibrate(100);
        await stopQrScanner();
        qrScanModal.classList.remove('active');

        let orderCode = decodedText.trim();
        if (orderCode.includes('/')) {
            const parts = orderCode.split('/');
            orderCode = parts[parts.length - 1].split('?')[0];
        }

        if (!/^\d{9,12}$/.test(orderCode)) {
            toast('QR-код не распознан как код заказа', 'error');
            return;
        }

        try {
            const response = await apiRequest(`/orders/admin/code/${encodeURIComponent(orderCode)}`);
            if (response.ok) {
                await viewOrder(orderCode);
            } else {
                toast('Заказ не найден', 'error');
            }
        } catch (e) {
            toast('Ошибка поиска заказа', 'error');
        }
    }

    // Manual QR code entry
    async function findOrderByCodeManual() {
        const orderCode = document.getElementById('qrOrderNumber').value.trim();
        const qrManualMessage = document.getElementById('qrManualMessage');
        if (!orderCode) {
            qrManualMessage.textContent = 'Введите код заказа';
            qrManualMessage.className = 'error-message';
            qrManualMessage.style.display = 'block';
            return;
        }
        if (!/^\d{9,12}$/.test(orderCode)) {
            qrManualMessage.textContent = 'Код заказа: 9-12 цифр';
            qrManualMessage.className = 'error-message';
            qrManualMessage.style.display = 'block';
            return;
        }
        try {
            const response = await apiRequest(`/orders/admin/code/${encodeURIComponent(orderCode)}`);
            if (response.ok) {
                qrManualModal.classList.remove('active');
                await viewOrder(orderCode);
            } else {
                qrManualMessage.textContent = 'Заказ не найден';
                qrManualMessage.className = 'error-message';
                qrManualMessage.style.display = 'block';
            }
        } catch (e) {
            qrManualMessage.textContent = 'Ошибка поиска заказа';
            qrManualMessage.className = 'error-message';
            qrManualMessage.style.display = 'block';
        }
    }

    closeModal.addEventListener('click', () => orderModal.classList.remove('active'));
    closeQrModal.addEventListener('click', async () => {
        qrScanModal.classList.remove('active');
        await stopQrScanner();
    });
    qrScanModal.addEventListener('click', async (e) => {
        if (e.target === qrScanModal) {
            qrScanModal.classList.remove('active');
            await stopQrScanner();
        }
    });
    qrManualModal.addEventListener('click', (e) => { if (e.target === qrManualModal) qrManualModal.classList.remove('active'); });
    orderModal.addEventListener('click', (e) => { if (e.target === orderModal) orderModal.classList.remove('active'); });

    scanQrBtn.addEventListener('click', async () => {
        document.getElementById('qrMessage').style.display = 'none';
        qrScanModal.classList.add('active');
        await startQrScanner();
    });

    document.getElementById('manualQrBtn').addEventListener('click', () => {
        document.getElementById('qrOrderNumber').value = '';
        document.getElementById('qrManualMessage').style.display = 'none';
        qrManualModal.classList.add('active');
        setTimeout(() => document.getElementById('qrOrderNumber').focus(), 0);
    });

    closeQrManualModal.addEventListener('click', () => qrManualModal.classList.remove('active'));
    document.getElementById('cancelQrBtn').addEventListener('click', async () => {
        qrScanModal.classList.remove('active');
        await stopQrScanner();
    });
    document.getElementById('cancelQrManualBtn').addEventListener('click', () => qrManualModal.classList.remove('active'));

    async function findOrderByCode() {
        await findOrderByCodeManual();
    }

    document.getElementById('findOrderBtn').addEventListener('click', findOrderByCode);
    document.getElementById('qrOrderNumber').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); findOrderByCode(); }
    });

    statusFilter.addEventListener('change', filterAndDisplay);
    searchInput.addEventListener('input', debounce(filterAndDisplay, 200));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (orderModal.classList.contains('active')) orderModal.classList.remove('active');
            if (qrScanModal.classList.contains('active')) { qrScanModal.classList.remove('active'); stopQrScanner(); }
            if (qrManualModal.classList.contains('active')) qrManualModal.classList.remove('active');
        }
    });

    // Автообновление при видимой вкладке
    function startAutoRefresh() {
        if (refreshTimer) return;
        refreshTimer = setInterval(() => {
            if (document.visibilityState === 'visible' && !orderModal.classList.contains('active') && !qrScanModal.classList.contains('active')) {
                loadOrders();
            }
        }, 30000);
    }
    function stopAutoRefresh() {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }
    window.addEventListener('beforeunload', async () => { stopAutoRefresh(); await stopQrScanner(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') stopAutoRefresh();
        else startAutoRefresh();
    });

    await loadOrders();
    startAutoRefresh();
})();
