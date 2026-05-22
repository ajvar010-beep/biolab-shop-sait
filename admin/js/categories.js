// Управление категориями

checkAuth();
document.getElementById('adminUsername').textContent = getUsername();

// Выход
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Вы уверены, что хотите выйти?')) {
        logout();
    }
});

let categories = [];

// Элементы
const categoriesContainer = document.getElementById('categoriesContainer');
const categoryModal = document.getElementById('categoryModal');
const categoryForm = document.getElementById('categoryForm');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const categoryNameInput = document.getElementById('categoryName');
const categorySlugInput = document.getElementById('categorySlug');

// Загрузка категорий
async function loadCategories() {
    try {
        const response = await apiRequest('/categories');
        categories = await response.json();
        displayCategories();
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        categoriesContainer.innerHTML = '<div class="error-message">Ошибка загрузки категорий</div>';
    }
}

function displayCategories() {
    if (categories.length === 0) {
        categoriesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <h3>Категорий пока нет</h3>
                <p>Добавьте первую категорию, нажав кнопку "Добавить категорию"</p>
            </div>
        `;
        return;
    }

    const table = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Slug</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(category => `
                        <tr>
                            <td><strong>${category.name}</strong></td>
                            <td><code>${category.slug}</code></td>
                            <td>
                                <button class="btn btn-danger btn-small" onclick="deleteCategory('${category._id}', '${category.name}')">🗑️ Удалить</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    categoriesContainer.innerHTML = table;
}

// Открытие модального окна
addCategoryBtn.addEventListener('click', () => {
    categoryForm.reset();
    document.getElementById('formMessage').style.display = 'none';
    categoryModal.classList.add('active');
});

// Закрытие модального окна
closeModal.addEventListener('click', () => {
    categoryModal.classList.remove('active');
});

cancelBtn.addEventListener('click', () => {
    categoryModal.classList.remove('active');
});

// Автогенерация slug из названия
categoryNameInput.addEventListener('input', (e) => {
    const name = e.target.value;
    const slug = name
        .toLowerCase()
        .replace(/[а-яё]/g, (char) => {
            const map = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
                'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
                'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
            };
            return map[char] || char;
        })
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    categorySlugInput.value = slug;
});

// Добавление категории
categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Добавление...';
    formMessage.style.display = 'none';

    try {
        const name = categoryNameInput.value.trim();
        const slug = categorySlugInput.value.trim();

        const response = await apiRequest('/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, slug })
        });

        if (response.ok) {
            categoryModal.classList.remove('active');
            await loadCategories();
            alert('Категория успешно добавлена');
        } else {
            const data = await response.json();
            formMessage.textContent = data.message || 'Ошибка добавления категории';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка добавления категории:', error);
        formMessage.textContent = 'Ошибка добавления категории';
        formMessage.className = 'error-message';
        formMessage.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Добавить';
    }
});

// Удаление категории
window.deleteCategory = async (categoryId, categoryName) => {
    if (!confirm(`Вы уверены, что хотите удалить категорию "${categoryName}"?\n\nВнимание: товары этой категории не будут удалены, но останутся без категории.`)) {
        return;
    }

    try {
        const response = await apiRequest(`/categories/${categoryId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadCategories();
            alert('Категория успешно удалена');
        } else {
            const data = await response.json();
            alert('Ошибка удаления: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        alert('Ошибка удаления категории');
    }
};

// Загрузка при открытии страницы
loadCategories();
