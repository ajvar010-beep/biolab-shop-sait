// Модуль авторизации админки
//
// Дизайн:
// - JWT в localStorage. Это уязвимо к XSS, поэтому весь UI рендерится без innerHTML
//   с пользовательскими данными (см. ui.js).
// - Никакого самописного CSRF на клиенте: бэкенд проверяет Origin для не-GET запросов,
//   и tokenVersion в БД позволяет инвалидировать токены при logout.
// - На защищённых страницах ждём checkAuth() перед загрузкой данных.

const API_URL = '/api';

function getToken() {
    return localStorage.getItem('adminToken');
}

function getUsername() {
    return localStorage.getItem('adminUsername') || 'Администратор';
}

function setAuth(token, username) {
    localStorage.setItem('adminToken', token);
    if (username) localStorage.setItem('adminUsername', username);
}

function clearAuth() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
}

async function logout({ silent = false } = {}) {
    const token = getToken();
    if (token) {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (_) { /* ignore */ }
    }
    clearAuth();
    if (!silent) window.location.href = 'login.html';
}

// Проверка токена. Возвращает true/false. Не редиректит сама — это делает вызывающий.
async function checkAuth() {
    const token = getToken();
    if (!token) return false;

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            clearAuth();
            return false;
        }
        const data = await response.json().catch(() => null);
        if (data && data.admin && data.admin.username) {
            localStorage.setItem('adminUsername', data.admin.username);
        }
        return true;
    } catch (_) {
        return false;
    }
}

// Гард для защищённых страниц: если не авторизован — редирект на логин
async function requireAuth() {
    const ok = await checkAuth();
    if (!ok) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// API запрос с токеном.
// На 401 чистим токен и редиректим на логин.
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        throw new Error('Нет токена');
    }

    const headers = Object.assign({}, options.headers || {});
    headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, Object.assign({}, options, { headers }));
    } catch (e) {
        throw new Error('Ошибка сети. Проверьте подключение.');
    }

    if (response.status === 401) {
        clearAuth();
        window.location.href = 'login.html';
        throw new Error('Не авторизован');
    }
    return response;
}

// ===== Auto-logout по неактивности =====
// Не запускаем таймер на странице логина, а на остальных — с throttle, чтобы не убивать CPU.
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
let inactivityTimer = null;
let lastResetAt = 0;

function resetInactivityTimer() {
    const now = Date.now();
    // throttle: сбрасываем не чаще раза в секунду
    if (now - lastResetAt < 1000) return;
    lastResetAt = now;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert('Сессия истекла из-за неактивности');
        logout();
    }, INACTIVITY_TIMEOUT);
}

(function initInactivityTracking() {
    // На странице логина не нужно
    if (/login\.html$/.test(window.location.pathname)) return;
    ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach((event) => {
        document.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    document.addEventListener('mousemove', resetInactivityTimer, { passive: true });
    resetInactivityTimer();
})();

// Экспорт в глобал для страниц
window.adminAuth = {
    API_URL,
    getToken,
    getUsername,
    setAuth,
    clearAuth,
    logout,
    checkAuth,
    requireAuth,
    apiRequest
};
