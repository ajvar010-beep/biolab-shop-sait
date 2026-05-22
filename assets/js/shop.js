// API Configuration
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : `${window.location.protocol}//${window.location.hostname}/api`;

// Загрузка товаров из API
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error('Ошибка загрузки товаров');

        const products = await response.json();
        renderProducts(products);
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Не удалось загрузить товары. Попробуйте обновить страницу.');
    }
}

// Отображение товаров
function renderProducts(products) {
    const tilesContainer = document.querySelector('.tiles');
    tilesContainer.innerHTML = '';

    if (products.length === 0) {
        tilesContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 40px;">Товары пока не добавлены</p>';
        return;
    }

    let modelCounter = 0;

    products.forEach(product => {
        modelCounter++;

        // Размер карточки
        let sizeClass = '';
        if (product.size === 'wide') sizeClass = 'size-wide';
        if (product.size === 'large') sizeClass = 'size-large';

        // Описание
        const htmlDescription = product.description
            .replace(/\r\n|\r|\n/g, '<br>')
            .replace(/\\n/g, '<br>');

        // Защита текста для Fancybox
        let captionText = `<b>${product.title}</b>` +
            (htmlDescription ? `<br><br>${htmlDescription}` : '') +
            `<br><br><strong>Цена: ${product.price} ₽</strong>` +
            (product.stock > 0 ? `<br>В наличии: ${product.stock} шт.` : '<br><span style="color: #ff6b6b;">Нет в наличии</span>');

        let safeCaptionAttr = captionText.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        // URL изображения
        const imgUrl = product.imageUrl.startsWith('http')
            ? product.imageUrl
            : `${API_URL.replace('/api', '')}${product.imageUrl}`;

        // 3D модель
        const hasModel = product.modelUrl && product.modelUrl !== '';
        const fancyboxParams = hasModel
            ? `data-src="#model-${modelCounter}" data-type="inline"`
            : `href="${imgUrl}"`;

        const inlineModelHtml = hasModel ? `
            <div id="model-${modelCounter}" class="model-container">
                <model-viewer src="${product.modelUrl}" auto-rotate camera-controls shadow-intensity="1" ar ar-modes="webxr scene-viewer quick-look"></model-viewer>
            </div>
        ` : '';

        const article = document.createElement('article');
        article.className = sizeClass;
        article.setAttribute('data-search', (product.title + ' ' + product.description + ' ' + product.category).toLowerCase());
        article.setAttribute('data-product-id', product._id);

        // Кнопка заказа
        const orderButton = product.stock > 0
            ? `<button class="order-btn" onclick="openOrderModal('${product._id}', '${product.title.replace(/'/g, "\\'")}', ${product.price})">Заказать</button>`
            : `<button class="order-btn" disabled style="opacity: 0.5; cursor: not-allowed;">Нет в наличии</button>`;

        article.innerHTML = `
            <span class="image" style="display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background-image: url('${imgUrl}'); background-size: cover; background-position: center;"></span>

            <a ${fancyboxParams} data-fancybox="gallery" data-caption="${safeCaptionAttr}" style="position: relative; z-index: 1;">
                <h2>${product.title}</h2>
                <div class="content">
                    ${htmlDescription ? `<p>${htmlDescription}</p>` : ''}
                </div>
            </a>

            <div class="price-badge">
                ${product.price} ₽
            </div>

            <div style="position: absolute; bottom: 20px; left: 20px; right: 20px; z-index: 2;">
                ${orderButton}
            </div>

            ${inlineModelHtml}
        `;

        tilesContainer.appendChild(article);
    });

    // Убираем обработчики кликов шаблона
    if (typeof jQuery !== 'undefined') {
        jQuery('.tiles article').off('click');
        jQuery('.tiles article a').off('click');
    }

    // Включаем галерею
    Fancybox.bind('[data-fancybox="gallery"]', {
        Hash: false,
        Image: { fit: "contain", zoom: false }
    });

    // Повторно снимаем обработчики
    if (typeof jQuery !== 'undefined') {
        jQuery(document).off('click.tiles', '.tiles article');
    }
}

// Открытие модального окна заказа
function openOrderModal(productId, productTitle, productPrice) {
    const modal = document.getElementById('orderModal');
    document.getElementById('modalProductTitle').textContent = productTitle;
    document.getElementById('modalProductPrice').textContent = `${productPrice} ₽`;
    document.getElementById('orderProductId').value = productId;
    document.getElementById('orderProductTitle').value = productTitle;
    document.getElementById('orderProductPrice').value = productPrice;
    modal.style.display = 'flex';
}

// Закрытие модального окна
function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    modal.style.display = 'none';
    document.getElementById('orderForm').reset();
}

// Отправка заказа
async function submitOrder(event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    const formData = {
        customerName: form.customerName.value,
        customerPhone: form.customerPhone.value,
        customerEmail: form.customerEmail.value,
        items: [{
            productId: form.productId.value,
            title: form.productTitle.value,
            price: parseFloat(form.productPrice.value),
            quantity: parseInt(form.quantity.value)
        }],
        totalAmount: parseFloat(form.productPrice.value) * parseInt(form.quantity.value)
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Ошибка создания заказа');

        const result = await response.json();
        showOrderSuccess(result.order);
        closeOrderModal();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось создать заказ. Попробуйте еще раз.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить заказ';
    }
}

// Показать успешный заказ с QR-кодом
function showOrderSuccess(order) {
    const modal = document.getElementById('successModal');
    document.getElementById('orderNumber').textContent = order.orderNumber;
    document.getElementById('qrCodeImage').src = order.qrCode;
    document.getElementById('orderEmail').textContent = order.customerEmail || 'не указан';
    modal.style.display = 'flex';
}

// Закрыть модальное окно успеха
function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

// Показать ошибку
function showError(message) {
    const tilesContainer = document.querySelector('.tiles');
    tilesContainer.innerHTML = `<p style="text-align: center; width: 100%; padding: 40px; color: #ff6b6b;">${message}</p>`;
}

// Поиск
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        const articles = document.querySelectorAll('.tiles article');
        let visibleCount = 0;

        articles.forEach(function(article) {
            const text = article.getAttribute('data-search') || '';
            const match = !query || text.includes(query);
            article.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });

        const emptyMsg = document.getElementById('searchEmptyMsg');
        if (emptyMsg) {
            emptyMsg.style.display = (visibleCount === 0 && query !== '') ? 'block' : 'none';
        }
    });
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
    setupSearch();
});

// Закрытие модальных окон по клику вне их
window.onclick = function(event) {
    const orderModal = document.getElementById('orderModal');
    const successModal = document.getElementById('successModal');

    if (event.target === orderModal) {
        closeOrderModal();
    }
    if (event.target === successModal) {
        closeSuccessModal();
    }
}
