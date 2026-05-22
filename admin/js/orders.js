// Управление заказами

checkAuth();
document.getElementById('adminUsername').textContent = getUsername();

// Выход
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Вы уверены, что хотите выйти?')) {
        logout();
    }
});

let orders = [];
let currentOrder = null;

// Элементы
const ordersContainer = document.getElementById('ordersContainer');
const orderModal = document.getElementById('orderModal');
const qrScanModal = document.getElementById('qrScanModal');
const closeModal = document.getElementById('closeModal');
const closeQrModal = document.getElementById('closeQrModal');
const scanQrBtn = document.getElementById('scanQrBtn');
const statusFilter = document.getElementById('statusFilter');
const searchInput = document.getElementById('searchInput');

// Загрузка заказов
async function loadOrders() {
    try {
        const response = await apiRequest('/orders');
        orders = await response.json();

        // Сортировка по дате (новые первые)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        displayOrders(orders);
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        ordersContainer.innerHTML = '<div class="error-message">Ошибка загрузки заказов</div>';
    }
}

function displayOrders(ordersToShow) {
    if (ordersToShow.length === 0) {
        ordersContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3>Заказов пока нет</h3>
                <p>Когда клиенты начнут делать заказы, они появятся здесь</p>
            </div>
        `;
        return;
    }

    const table = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Номер</th>
                        <th>Дата</th>
                        <th>Клиент</th>
                        <th>Телефон</th>
                        <th>Товары</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${ordersToShow.map(order => `
                        <tr>
                            <td><strong>${order.orderNumber}</strong></td>
                            <td>${formatDate(order.createdAt)}</td>
                            <td>${order.customerName}</td>
                            <td>${order.customerPhone}</td>
                            <td>${order.items.length} шт.</td>
                            <td><strong>${order.totalAmount} ₽</strong></td>
                            <td><span class="badge badge-${order.status}">${getStatusText(order.status)}</span></td>
                            <td>
                                <div class="actions">
                                    <button class="btn btn-secondary btn-small" onclick="viewOrder('${order.orderNumber}')">👁️</button>
                                    ${order.status === 'pending' ? `
                                        <button class="btn btn-primary btn-small" onclick="completeOrder('${order.orderNumber}')">✅</button>
                                        <button class="btn btn-danger btn-small" onclick="cancelOrder('${order.orderNumber}')">❌</button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    ordersContainer.innerHTML = table;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusText(status) {
    const statuses = {
        'pending': 'Ожидает',
        'completed': 'Выдан',
        'cancelled': 'Отменён'
    };
    return statuses[status] || status;
}

// Просмотр заказа
window.viewOrder = async (orderNumber) => {
    try {
        const response = await apiRequest(`/orders/number/${orderNumber}`);
        currentOrder = await response.json();

        document.getElementById('modalOrderNumber').textContent = currentOrder.orderNumber;

        const detailsHtml = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 10px;">Информация о клиенте</h3>
                    <p><strong>Имя:</strong> ${currentOrder.customerName}</p>
                    <p><strong>Телефон:</strong> ${currentOrder.customerPhone}</p>
                    <p><strong>Email:</strong> ${currentOrder.customerEmail}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 10px;">Товары</h3>
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Название</th>
                                <th>Количество</th>
                                <th>Цена</th>
                                <th>Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${currentOrder.items.map(item => `
                                <tr>
                                    <td>${item.title}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.price} ₽</td>
                                    <td><strong>${item.price * item.quantity} ₽</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="text-align: right;"><strong>Итого:</strong></td>
                                <td><strong>${currentOrder.totalAmount} ₽</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 10px;">QR-код</h3>
                    <div class="qr-code">
                        <img src="${currentOrder.qrCode}" alt="QR Code">
                        <p style="margin-top: 10px; color: var(--text-muted);">Покажите этот QR-код клиенту</p>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <p><strong>Статус:</strong> <span class="badge badge-${currentOrder.status}">${getStatusText(currentOrder.status)}</span></p>
                    <p><strong>Дата создания:</strong> ${formatDate(currentOrder.createdAt)}</p>
                    ${currentOrder.completedAt ? `<p><strong>Дата выдачи:</strong> ${formatDate(currentOrder.completedAt)}</p>` : ''}
                </div>

                ${currentOrder.status === 'pending' ? `
                    <div class="modal-footer">
                        <button class="btn btn-danger" onclick="cancelOrder('${currentOrder.orderNumber}')">Отменить заказ</button>
                        <button class="btn btn-primary" onclick="completeOrder('${currentOrder.orderNumber}')">Выдать заказ</button>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('orderDetails').innerHTML = detailsHtml;
        orderModal.classList.add('active');
    } catch (error) {
        console.error('Ошибка загрузки заказа:', error);
        alert('Ошибка загрузки заказа');
    }
};

// Выдать заказ
window.completeOrder = async (orderNumber) => {
    if (!confirm('Подтвердите выдачу заказа клиенту')) {
        return;
    }

    try {
        const response = await apiRequest(`/orders/${orderNumber}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'completed' })
        });

        if (response.ok) {
            orderModal.classList.remove('active');
            await loadOrders();
            alert('Заказ успешно выдан');
        } else {
            const data = await response.json();
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка обновления заказа:', error);
        alert('Ошибка обновления заказа');
    }
};

// Отменить заказ
window.cancelOrder = async (orderNumber) => {
    const reason = prompt('Укажите причину отмены заказа:');
    if (!reason) return;

    try {
        const response = await apiRequest(`/orders/${orderNumber}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        if (response.ok) {
            orderModal.classList.remove('active');
            await loadOrders();
            alert('Заказ отменён');
        } else {
            const data = await response.json();
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        alert('Ошибка отмены заказа');
    }
};

// Закрытие модальных окон
closeModal.addEventListener('click', () => {
    orderModal.classList.remove('active');
});

closeQrModal.addEventListener('click', () => {
    qrScanModal.classList.remove('active');
});

// Сканирование QR
scanQrBtn.addEventListener('click', () => {
    document.getElementById('qrOrderNumber').value = '';
    document.getElementById('qrMessage').style.display = 'none';
    qrScanModal.classList.add('active');
});

document.getElementById('cancelQrBtn').addEventListener('click', () => {
    qrScanModal.classList.remove('active');
});

document.getElementById('findOrderBtn').addEventListener('click', async () => {
    const orderNumber = document.getElementById('qrOrderNumber').value.trim();
    const qrMessage = document.getElementById('qrMessage');

    if (!orderNumber) {
        qrMessage.textContent = 'Введите номер заказа';
        qrMessage.className = 'error-message';
        qrMessage.style.display = 'block';
        return;
    }

    try {
        const response = await apiRequest(`/orders/number/${orderNumber}`);

        if (response.ok) {
            qrScanModal.classList.remove('active');
            await viewOrder(orderNumber);
        } else {
            qrMessage.textContent = 'Заказ не найден';
            qrMessage.className = 'error-message';
            qrMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка поиска заказа:', error);
        qrMessage.textContent = 'Ошибка поиска заказа';
        qrMessage.className = 'error-message';
        qrMessage.style.display = 'block';
    }
});

// Enter для поиска заказа
document.getElementById('qrOrderNumber').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('findOrderBtn').click();
    }
});

// Фильтрация
statusFilter.addEventListener('change', filterOrders);
searchInput.addEventListener('input', filterOrders);

function filterOrders() {
    const status = statusFilter.value;
    const search = searchInput.value.toLowerCase();

    let filtered = orders;

    if (status) {
        filtered = filtered.filter(o => o.status === status);
    }

    if (search) {
        filtered = filtered.filter(o =>
            o.orderNumber.toLowerCase().includes(search) ||
            o.customerName.toLowerCase().includes(search) ||
            o.customerPhone.includes(search)
        );
    }

    displayOrders(filtered);
}

// Загрузка при открытии страницы
loadOrders();

// Автообновление каждые 30 секунд
setInterval(loadOrders, 30000);
