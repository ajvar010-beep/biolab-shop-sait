// Модуль авторизации админки
//
// Дизайн:
// - JWT в localStorage. Это уязвимо к XSS, поэтому весь UI рендерится без innerHTML
//   с пользовательскими данными (см. ui.js).
// - CSRF-защита: double-submit cookie + X-CSRF-Token header.
//   Токен получаем при логине и храним в localStorage.
// - tokenVersion в БД позволяет инвалидировать токены при logout.

const API_URL = '/api';

function getToken() {
    return localStorage.getItem('adminToken');
}

function getUsername() {
    return localStorage.getItem('adminUsername') || 'Администратор';
}

// Уровень доступа: 1 — обычный админ, 2 — менеджер, 3 — владелец.
// Источник правды — сервер (verify/login). Здесь это кэш для UX-гейтинга.
function getLevel() {
    const n = parseInt(localStorage.getItem('adminLevel'), 10);
    return Number.isFinite(n) && n >= 1 && n <= 3 ? n : 1;
}

function setLevel(level) {
    const n = parseInt(level, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 3) {
        localStorage.setItem('adminLevel', String(n));
    }
}

function setAuth(token, username) {
    localStorage.setItem('adminToken', token);
    if (username) localStorage.setItem('adminUsername', username);
}

function clearAuth() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    localStorage.removeItem('adminLevel');
    localStorage.removeItem('csrfToken');
}

// CSRF-токен
function getCsrfToken() {
    return localStorage.getItem('csrfToken');
}

// Получить CSRF-токен с сервера
async function fetchCsrfToken() {
    try {
        const res = await fetch(`${API_URL}/auth/csrf-token`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.csrfToken) localStorage.setItem('csrfToken', data.csrfToken);
        }
    } catch (_) {}
}

async function logout({ silent = false } = {}) {
    const token = getToken();
    if (token) {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-CSRF-Token': getCsrfToken() || ''
                },
                credentials: 'include'
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
        if (data && data.admin && data.admin.level) {
            setLevel(data.admin.level);
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
    // Также получаем свежий CSRF-токен
    await fetchCsrfToken();
    return true;
}

// Скрыть элементы, требующие уровень выше текущего.
// Элемент помечается атрибутом data-min-level="2|3". Это ТОЛЬКО UX —
// настоящую защиту обеспечивает сервер (requireLevel).
function applyLevelGating(root = document) {
    const level = getLevel();
    const nodes = root.querySelectorAll('[data-min-level]');
    nodes.forEach((node) => {
        const min = parseInt(node.getAttribute('data-min-level'), 10) || 1;
        if (level < min) {
            node.style.display = 'none';
            node.setAttribute('aria-hidden', 'true');
        }
    });
}

// Гард для страниц, требующих минимальный уровень. При нехватке — редирект на главную.
async function requireLevelOrRedirect(minLevel) {
    if (!(await requireAuth())) return false;
    if (getLevel() < minLevel) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// API запрос с токенами (JWT + CSRF).
// На 401 чистим токен и редиректим на логин.
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        throw new Error('Нет токена');
    }

    const headers = Object.assign({}, options.headers || {});
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-CSRF-Token'] = getCsrfToken() || '';
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, Object.assign({}, options, {
            headers,
            credentials: 'include'
        }));
    } catch (e) {
        throw new Error('Ошибка сети. Проверьте подключение.');
    }

    if (response.status === 401) {
        clearAuth();
        window.location.href = 'login.html';
        throw new Error('Не авторизован');
    }

    // Самовосстановление при рассинхроне CSRF (например, cookie истёк/пересоздан):
    // один раз обновляем токен и повторяем мутацию.
    if (response.status === 403 && !options._csrfRetried) {
        const data = await response.clone().json().catch(() => null);
        if (data && typeof data.message === 'string' && /csrf/i.test(data.message)) {
            await fetchCsrfToken();
            return apiRequest(endpoint, Object.assign({}, options, { _csrfRetried: true }));
        }
    }
    return response;
}

// ===== Auto-logout по неактивности =====
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
let inactivityTimer = null;
let lastResetAt = 0;

function resetInactivityTimer() {
    const now = Date.now();
    if (now - lastResetAt < 1000) return;
    lastResetAt = now;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert('Сессия истекла из-за неактивности');
        logout();
    }, INACTIVITY_TIMEOUT);
}

(function initInactivityTracking() {
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
    getLevel,
    setLevel,
    setAuth,
    clearAuth,
    getCsrfToken,
    fetchCsrfToken,
    logout,
    checkAuth,
    requireAuth,
    requireLevelOrRedirect,
    applyLevelGating,
    apiRequest
};
