// Управление категориями
(async function () {
    'use strict';
    const { requireAuth, apiRequest, logout, getUsername } = window.adminAuth;
    const { el, clear, toast, confirmDialog } = window.adminUI;

    if (!(await requireAuth())) return;
    document.getElementById('adminUsername').textContent = getUsername();

    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (await confirmDialog({ title: 'Выход', message: 'Выйти из админки?', confirmText: 'Выйти', danger: true })) {
            logout();
        }
    });

    let categoriesList = [];
    let slugManuallyEdited = false;

    const categoriesContainer = document.getElementById('categoriesContainer');
    const categoryModal = document.getElementById('categoryModal');
    const categoryForm = document.getElementById('categoryForm');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const categoryNameInput = document.getElementById('categoryName');
    const categorySlugInput = document.getElementById('categorySlug');

    function transliterate(str) {
        const map = {
            'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
            'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
            'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
            'э':'e','ю':'yu','я':'ya'
        };
        return str.toLowerCase().replace(/./g, ch => map[ch] !== undefined ? map[ch] : ch);
    }
    function makeSlug(name) {
        return transliterate(String(name)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    async function loadCategories() {
        try {
            const response = await apiRequest('/categories');
            categoriesList = await response.json();
            displayCategories();
        } catch (e) {
            clear(categoriesContainer);
            categoriesContainer.appendChild(el('div', { class: 'error-message', text: 'Ошибка загрузки категорий' }));
        }
    }

    function displayCategories() {
        clear(categoriesContainer);
        if (categoriesList.length === 0) {
            categoriesContainer.appendChild(el('div', { class: 'empty-state' }, [
                el('div', { class: 'empty-state-icon', text: '📁' }),
                el('h3', { text: 'Категорий пока нет' }),
                el('p', { text: 'Добавьте первую категорию' })
            ]));
            return;
        }

        const table = el('table');
        table.appendChild(el('thead', {}, [
            el('tr', {}, [
                el('th', { text: 'Название' }),
                el('th', { text: 'Slug' }),
                el('th', { text: 'Действия' })
            ])
        ]));
        const tbody = el('tbody');
        for (const cat of categoriesList) {
            const delBtn = el('button', { class: 'btn btn-danger btn-small', type: 'button', text: '🗑️ Удалить' });
            delBtn.addEventListener('click', () => onDelete(cat._id, cat.name));
            tbody.appendChild(el('tr', {}, [
                el('td', {}, [el('strong', { text: cat.name })]),
                el('td', {}, [el('code', { text: cat.slug })]),
                el('td', {}, [delBtn])
            ]));
        }
        table.appendChild(tbody);
        categoriesContainer.appendChild(el('div', { class: 'table-container' }, [table]));
    }

    addCategoryBtn.addEventListener('click', () => {
        categoryForm.reset();
        slugManuallyEdited = false;
        document.getElementById('formMessage').style.display = 'none';
        categoryModal.classList.add('active');
        setTimeout(() => categoryNameInput.focus(), 0);
    });

    closeModal.addEventListener('click', () => categoryModal.classList.remove('active'));
    cancelBtn.addEventListener('click', () => categoryModal.classList.remove('active'));
    categoryModal.addEventListener('click', (e) => { if (e.target === categoryModal) categoryModal.classList.remove('active'); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && categoryModal.classList.contains('active')) {
            categoryModal.classList.remove('active');
        }
    });

    categoryNameInput.addEventListener('input', () => {
        if (!slugManuallyEdited) {
            categorySlugInput.value = makeSlug(categoryNameInput.value);
        }
    });
    categorySlugInput.addEventListener('input', () => { slugManuallyEdited = true; });

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        const formMessage = document.getElementById('formMessage');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Добавление...';
        formMessage.style.display = 'none';

        try {
            const name = categoryNameInput.value.trim();
            const slug = categorySlugInput.value.trim() || makeSlug(name);

            if (!name) throw new Error('Укажите название');
            if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug: только латиница, цифры и дефисы');

            const response = await apiRequest('/categories', {
                method: 'POST',
                body: JSON.stringify({ name, slug })
            });

            if (response.ok) {
                categoryModal.classList.remove('active');
                await loadCategories();
                toast('Категория добавлена', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                formMessage.textContent = data.message || 'Ошибка добавления';
                formMessage.className = 'error-message';
                formMessage.style.display = 'block';
            }
        } catch (err) {
            formMessage.textContent = err.message || 'Ошибка добавления категории';
            formMessage.className = 'error-message';
            formMessage.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Добавить';
        }
    });

    async function onDelete(categoryId, categoryName) {
        if (!await confirmDialog({
            title: 'Удалить категорию',
            message: `Удалить категорию «${categoryName}»? Если в ней есть товары — удаление не выполнится.`,
            confirmText: 'Удалить',
            danger: true
        })) return;

        try {
            const response = await apiRequest(`/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
            if (response.ok) {
                await loadCategories();
                toast('Категория удалена', 'success');
            } else {
                const data = await response.json().catch(() => ({}));
                toast(data.message || 'Ошибка удаления', 'error');
            }
        } catch (e) {
            toast('Ошибка удаления категории', 'error');
        }
    }

    await loadCategories();
})();
