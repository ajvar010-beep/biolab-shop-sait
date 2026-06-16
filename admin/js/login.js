// Логика страницы логина
(function () {
    'use strict';

    const { setAuth, getToken, API_URL, fetchCsrfToken, setLevel, getToken: _getToken } = window.adminAuth;

    // Если уже авторизован — сразу на главную
    if (getToken()) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        errorMessage.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Вход...';

        try {
            // Сначала получаем CSRF-токен
            await fetchCsrfToken();
            const csrfToken = localStorage.getItem('csrfToken') || '';

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            let data = null;
            try { data = await response.json(); } catch (_) {}

            if (response.ok && data && data.token) {
                setAuth(data.token, data.admin && data.admin.username || username);
                if (data.admin && data.admin.level) setLevel(data.admin.level);
                // После логина обновляем CSRF-токен
                await fetchCsrfToken();
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = (data && data.message) || 'Ошибка входа';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            errorMessage.textContent = 'Ошибка подключения к серверу';
            errorMessage.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Войти';
        }
    });
})();
