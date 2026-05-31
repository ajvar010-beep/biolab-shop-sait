// Управление товарами
(async function () {
    'use strict';
    const { requireAuth, apiRequest, logout, getUsername } = window.adminAuth;
    const { el, clear, safeImageUrl, toast, confirmDialog, debounce } = window.adminUI;

    if (!(await requireAuth())) return;
    document.getElementById('adminUsername').textContent = getUsername();

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    let products = [];
    let categories = [];
    let editingProductId = null;

    const productsContainer = document.getElementById('productsContainer');
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const addProductBtn = document.getElementById('addProductBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchInput = document.getElementById('searchInput');
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('imagePreview');

    const SIZE_TEXT = { normal: 'Обычная', wide: 'Широкая', large: 'Большая' };

    async function loadCategories() {
        try {
            const res = await apiRequest('/categories');
            categories = await res.json();
            populateCategorySelects();
        } catch (e) {
            toast('Ошибка загрузки категорий', 'error');
        }
    }

    async function loadProducts() {
        try {
            const res = await apiRequest('/products');
            products = await res.json();
            displayProducts(products);
        } catch (e) {
            clear(productsContainer);
            productsContainer.appendChild(el('div', { class: 'error-message', text: 'Ошибка загрузки товаров' }));
        }
    }

    function populateCategorySelects() {
        const categorySelect = document.getElementById('category');

        // Сохраняем выбранные значения, если они есть
        const selectedFilter = categoryFilter.value;
        const selectedForm = categorySelect.value;

        clear(categorySelect);
        clear(categoryFilter);

        categorySelect.add(new Option('Выберите категорию', ''));
        categoryFilter.add(new Option('Все категории', ''));

        for (const cat of categories) {
            categorySelect.add(new Option(cat.name, cat.name));
            categoryFilter.add(new Option(cat.name, cat.name));
        }

        if (selectedFilter) categoryFilter.value = selectedFilter;
        if (selectedForm) categorySelect.value = selectedForm;
    }

    function displayProducts(list) {
        clear(productsContainer);
        if (list.length === 0) {
            const empty = el('div', { class: 'empty-state' }, [
                el('div', { class: 'empty-state-icon', text: '🌿' }),
                el('h3', { text: 'Товаров пока нет' }),
                el('p', { text: 'Добавьте первый товар, нажав «Добавить товар»' })
            ]);
            productsContainer.appendChild(empty);
            return;
        }

        const table = el('table');
        const thead = el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Изображение' }),
                el('th', { text: 'Название' }),
                el('th', { text: 'Категория' }),
                el('th', { text: 'Цена' }),
                el('th', { text: 'Остаток' }),
                el('th', { text: 'Размер' }),
                el('th', { text: 'Действия' })
            ])
        ]);
        const tbody = el('tbody');

        for (const p of list) {
            const imgUrl = safeImageUrl(p.imageUrl);
            const imgCell = el('td');
            if (imgUrl) {
                imgCell.appendChild(el('img', { src: imgUrl, class: 'product-image', alt: p.title || '' }));
            } else {
                imgCell.appendChild(el('div', {
                    style: { width: '60px', height: '60px', background: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                    text: '🌿'
                }));
            }

            const stockColor = p.stock === 0 ? 'red' : (p.stock < 5 ? 'orange' : 'green');

            // Цена с учётом акции
            let priceDisplay;
            if (p.isOnSale) {
                priceDisplay = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                    el('span', { style: { textDecoration: 'line-through', color: '#999', fontSize: '12px' }, text: `${p.price} ₽` }),
                    el('span', { style: { color: '#ff6b6b', fontWeight: 'bold' }, text: `${p.currentPrice} ₽` }),
                    el('span', {
                        style: { background: '#ff6b6b', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' },
                        text: `-${Math.round((1 - p.currentPrice / p.price) * 100)}%`
                    })
                ]);
            } else {
                priceDisplay = el('span', { text: `${p.price} ₽` });
            }

            const editBtn = el('button', {
                class: 'btn btn-secondary btn-small',
                type: 'button',
                'aria-label': 'Редактировать',
                text: '✏️'
            });
            editBtn.addEventListener('click', () => openEdit(p._id));

            const delBtn = el('button', {
                class: 'btn btn-danger btn-small',
                type: 'button',
                'aria-label': 'Удалить',
                text: '🗑️'
            });
            delBtn.addEventListener('click', () => onDelete(p._id, p.title));

            const tr = el('tr', {}, [
                imgCell,
                el('td', {}, [el('strong', { text: p.title || '' })]),
                el('td', { text: p.category || '' }),
                el('td', {}, [priceDisplay]),
                el('td', {}, [
                    el('span', { style: { color: stockColor, fontWeight: 'bold' }, text: String(p.stock) })
                ]),
                el('td', { text: SIZE_TEXT[p.size] || p.size || 'Обычная' }),
                el('td', {}, [
                    el('div', { class: 'actions' }, [editBtn, delBtn])
                ])
            ]);
            tbody.appendChild(tr);
        }
        table.appendChild(thead);
        table.appendChild(tbody);
        productsContainer.appendChild(el('div', { class: 'table-container' }, [table]));
    }

    function openAdd() {
        editingProductId = null;
        document.getElementById('modalTitle').textContent = 'Добавить товар';
        productForm.reset();
        imagePreview.removeAttribute('src');
        imagePreview.style.display = 'none';
        document.getElementById('formMessage').style.display = 'none';
        productModal.classList.add('active');
    }

    function openEdit(productId) {
        editingProductId = productId;
        const product = products.find(p => p._id === productId);
        if (!product) return;

        document.getElementById('modalTitle').textContent = 'Редактировать товар';
        document.getElementById('productId').value = product._id;
        document.getElementById('title').value = product.title || '';
        document.getElementById('description').value = product.description || '';
        document.getElementById('price').value = product.price ?? '';
        document.getElementById('salePrice').value = product.salePrice || '';
        document.getElementById('saleStart').value = product.saleStart ? new Date(product.saleStart).toISOString().slice(0, 16) : '';
        document.getElementById('saleEnd').value = product.saleEnd ? new Date(product.saleEnd).toISOString().slice(0, 16) : '';
        document.getElementById('category').value = product.category || '';
        document.getElementById('stock').value = product.stock ?? '';
        document.getElementById('size').value = product.size || 'normal';
        document.getElementById('modelUrl').value = product.modelUrl || '';

        imageInput.value = '';
        const safeUrl = safeImageUrl(product.imageUrl);
        if (safeUrl) {
            imagePreview.src = safeUrl;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.removeAttribute('src');
            imagePreview.style.display = 'none';
        }
        document.getElementById('formMessage').style.display = 'none';
        productModal.classList.add('active');
    }

    function closeProductModal() {
        productModal.classList.remove('active');
    }

    addProductBtn.addEventListener('click', openAdd);
    closeModal.addEventListener('click', closeProductModal);
    cancelBtn.addEventListener('click', closeProductModal);

    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && productModal.classList.contains('active')) closeProductModal();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast('Файл больше 5MB', 'error');
            imageInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            imagePreview.src = ev.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    async function onDelete(productId, productTitle) {
        if (!await confirmDialog({
            title: 'Удалить товар',
            message: `Удалить товар «${productTitle}»? Действие необратимо.`,
            confirmText: 'Удалить',
            danger: true
        })) return;

        try {
            const response = await apiRequest(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
            if (response.ok) {
                await loadProducts();
                toast('Товар удалён', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                toast('Ошибка удаления: ' + (data.message || ''), 'error');
            }
        } catch (e) {
            toast('Ошибка удаления товара', 'error');
        }
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        const formMessage = document.getElementById('formMessage');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Сохранение...';
        formMessage.style.display = 'none';

        try {
            const formData = new FormData();
            formData.append('title', document.getElementById('title').value.trim());
            formData.append('description', document.getElementById('description').value.trim());
            formData.append('price', document.getElementById('price').value);
            formData.append('category', document.getElementById('category').value);
            formData.append('stock', document.getElementById('stock').value);
            formData.append('size', document.getElementById('size').value);

            // Акционные поля
            const salePrice = document.getElementById('salePrice').value.trim();
            if (salePrice) formData.append('salePrice', salePrice);

            const saleStart = document.getElementById('saleStart').value;
            if (saleStart) formData.append('saleStart', new Date(saleStart).toISOString());

            const saleEnd = document.getElementById('saleEnd').value;
            if (saleEnd) formData.append('saleEnd', new Date(saleEnd).toISOString());

            const modelUrl = document.getElementById('modelUrl').value.trim();
            if (modelUrl) formData.append('modelUrl', modelUrl);

            const imageFile = imageInput.files[0];
            if (imageFile) formData.append('image', imageFile);

            const url = editingProductId ? `/products/${encodeURIComponent(editingProductId)}` : '/products';
            const method = editingProductId ? 'PUT' : 'POST';
            const response = await apiRequest(url, { method, body: formData });

            if (response.ok) {
                closeProductModal();
                await loadProducts();
                toast(editingProductId ? 'Товар обновлён' : 'Товар добавлен', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                formMessage.textContent = data.message || 'Ошибка сохранения';
                formMessage.className = 'error-message';
                formMessage.style.display = 'block';
            }
        } catch (err) {
            formMessage.textContent = 'Ошибка сохранения товара';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Сохранить';
        }
    });

    function filterProducts() {
        const cat = categoryFilter.value;
        const search = searchInput.value.toLowerCase().trim();
        let list = products;
        if (cat) list = list.filter(p => p.category === cat);
        if (search) {
            list = list.filter(p =>
                String(p.title || '').toLowerCase().includes(search) ||
                String(p.description || '').toLowerCase().includes(search)
            );
        }
        displayProducts(list);
    }

    categoryFilter.addEventListener('change', filterProducts);
    searchInput.addEventListener('input', debounce(filterProducts, 200));

    // Загрузка
    await loadCategories();
    await loadProducts();
})();
