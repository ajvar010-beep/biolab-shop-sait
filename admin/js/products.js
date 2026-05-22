// Управление товарами

checkAuth();
document.getElementById('adminUsername').textContent = getUsername();

// Выход
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Вы уверены, что хотите выйти?')) {
        logout();
    }
});

let products = [];
let categories = [];
let editingProductId = null;

// Элементы
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

// Загрузка данных
async function loadData() {
    try {
        // Загрузка категорий
        const categoriesRes = await apiRequest('/categories');
        categories = await categoriesRes.json();
        populateCategorySelects();

        // Загрузка товаров
        await loadProducts();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        productsContainer.innerHTML = '<div class="error-message">Ошибка загрузки данных</div>';
    }
}

async function loadProducts() {
    try {
        const response = await apiRequest('/products');
        products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        productsContainer.innerHTML = '<div class="error-message">Ошибка загрузки товаров</div>';
    }
}

function populateCategorySelects() {
    const categorySelect = document.getElementById('category');

    categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
    categoryFilter.innerHTML = '<option value="">Все категории</option>';

    categories.forEach(cat => {
        categorySelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
        categoryFilter.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

function displayProducts(productsToShow) {
    if (productsToShow.length === 0) {
        productsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🌿</div>
                <h3>Товаров пока нет</h3>
                <p>Добавьте первый товар, нажав кнопку "Добавить товар"</p>
            </div>
        `;
        return;
    }

    const table = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Изображение</th>
                        <th>Название</th>
                        <th>Категория</th>
                        <th>Цена</th>
                        <th>Остаток</th>
                        <th>Размер</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${productsToShow.map(product => `
                        <tr>
                            <td>
                                ${product.imageUrl
                                    ? `<img src="${product.imageUrl}" class="product-image" alt="${product.title}">`
                                    : '<div style="width: 60px; height: 60px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;">🌿</div>'}
                            </td>
                            <td><strong>${product.title}</strong></td>
                            <td>${product.category}</td>
                            <td>${product.price} ₽</td>
                            <td>
                                <span style="color: ${product.stock === 0 ? 'red' : product.stock < 5 ? 'orange' : 'green'}; font-weight: bold;">
                                    ${product.stock}
                                </span>
                            </td>
                            <td>${getSizeText(product.size)}</td>
                            <td>
                                <div class="actions">
                                    <button class="btn btn-secondary btn-small" onclick="editProduct('${product._id}')">✏️</button>
                                    <button class="btn btn-danger btn-small" onclick="deleteProduct('${product._id}', '${product.title}')">🗑️</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    productsContainer.innerHTML = table;
}

function getSizeText(size) {
    const sizes = {
        'normal': 'Обычная',
        'wide': 'Широкая',
        'large': 'Большая'
    };
    return sizes[size] || size;
}

// Открытие модального окна для добавления
addProductBtn.addEventListener('click', () => {
    editingProductId = null;
    document.getElementById('modalTitle').textContent = 'Добавить товар';
    productForm.reset();
    imagePreview.style.display = 'none';
    productModal.classList.add('active');
});

// Закрытие модального окна
closeModal.addEventListener('click', () => {
    productModal.classList.remove('active');
});

cancelBtn.addEventListener('click', () => {
    productModal.classList.remove('active');
});

// Предпросмотр изображения
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Редактирование товара
window.editProduct = async (productId) => {
    editingProductId = productId;
    const product = products.find(p => p._id === productId);

    if (!product) return;

    document.getElementById('modalTitle').textContent = 'Редактировать товар';
    document.getElementById('productId').value = product._id;
    document.getElementById('title').value = product.title;
    document.getElementById('description').value = product.description;
    document.getElementById('price').value = product.price;
    document.getElementById('category').value = product.category;
    document.getElementById('stock').value = product.stock;
    document.getElementById('size').value = product.size || 'normal';
    document.getElementById('modelUrl').value = product.modelUrl || '';

    if (product.imageUrl) {
        imagePreview.src = product.imageUrl;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
    }

    productModal.classList.add('active');
};

// Удаление товара
window.deleteProduct = async (productId, productTitle) => {
    if (!confirm(`Вы уверены, что хотите удалить товар "${productTitle}"?`)) {
        return;
    }

    try {
        const response = await apiRequest(`/products/${productId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadProducts();
            alert('Товар успешно удалён');
        } else {
            const data = await response.json();
            alert('Ошибка удаления: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        alert('Ошибка удаления товара');
    }
};

// Сохранение товара
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';
    formMessage.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('stock', document.getElementById('stock').value);
        formData.append('size', document.getElementById('size').value);

        const modelUrl = document.getElementById('modelUrl').value;
        if (modelUrl) {
            formData.append('modelUrl', modelUrl);
        }

        const imageFile = imageInput.files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }

        let response;
        if (editingProductId) {
            response = await apiRequest(`/products/${editingProductId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            response = await apiRequest('/products', {
                method: 'POST',
                body: formData
            });
        }

        if (response.ok) {
            productModal.classList.remove('active');
            await loadProducts();
            alert(editingProductId ? 'Товар успешно обновлён' : 'Товар успешно добавлен');
        } else {
            const data = await response.json();
            formMessage.textContent = data.message || 'Ошибка сохранения';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка сохранения товара:', error);
        formMessage.textContent = 'Ошибка сохранения товара';
        formMessage.className = 'error-message';
        formMessage.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Сохранить';
    }
});

// Фильтрация по категории
categoryFilter.addEventListener('change', filterProducts);

// Поиск
searchInput.addEventListener('input', filterProducts);

function filterProducts() {
    const category = categoryFilter.value;
    const search = searchInput.value.toLowerCase();

    let filtered = products;

    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }

    if (search) {
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(search) ||
            p.description.toLowerCase().includes(search)
        );
    }

    displayProducts(filtered);
}

// Загрузка при открытии страницы
loadData();
