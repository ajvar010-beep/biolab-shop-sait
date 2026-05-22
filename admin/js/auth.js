// Модуль авторизации для админки

const API_URL = '/api';

// Получить токен из localStorage
function getToken() {
    return localStorage.getItem('adminToken');
}

// Получить имя пользователя
function getUsername() {
    return localStorage.getItem('adminUsername');
}

// Сохранить токен
function setToken(token, username) {
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUsername', username);
}

// Удалить токен (выход)
function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    window.location.href = 'login.html';
}

// Проверить авторизацию
async function checkAuth() {
    const token = getToken();

    if (!token) {
        window.location.href = 'login.html';
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            logout();
            return false;
        }

        return true;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        logout();
        return false;
    }
}

// Выполнить API запрос с авторизацией
async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    };

    // Если body это не FormData, добавляем Content-Type
    if (options.body && !(options.body instanceof FormData)) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        ...defaultOptions,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    });

    if (response.status === 401) {
        logout();
        throw new Error('Не авторизован');
    }

    return response;
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getToken,
        getUsername,
        setToken,
        logout,
        checkAuth,
        apiRequest,
        API_URL
    };
}
