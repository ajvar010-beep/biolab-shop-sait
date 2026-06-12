/**
 * hCaptcha callbacks — глобальные, необходимы для data-callback / data-expired-callback.
 * Вынесены из index.html в отдельный файл: CSP запрещает инлайн-скрипты (script-src без 'unsafe-inline').
 */
let _hcaptchaToken = null;

function onHcaptchaSuccess(token) {
  _hcaptchaToken = token;
  const btn = document.getElementById('checkoutSubmitBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Оформить заказ'; }
  const hint = document.getElementById('hcaptchaHint');
  if (hint) { hint.style.display = 'none'; }
}

function onHcaptchaExpired() {
  _hcaptchaToken = null;
  const btn = document.getElementById('checkoutSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Оформить заказ'; }
  const hint = document.getElementById('hcaptchaHint');
  if (hint) { hint.style.display = 'block'; hint.textContent = 'hCaptcha истекла. Повторите проверку.'; hint.style.color = '#e74c3c'; }
}

function onHcaptchaError() {
  _hcaptchaToken = null;
  const btn = document.getElementById('checkoutSubmitBtn');
  if (btn) { btn.disabled = true; }
  const hint = document.getElementById('hcaptchaHint');
  if (hint) { hint.style.display = 'block'; hint.textContent = 'hCaptcha ошибка. Обновите страницу и попробуйте снова.'; hint.style.color = '#e74c3c'; }
}

function getHcaptchaToken() { return _hcaptchaToken; }

// Если hCaptcha не настроена (sitekey-заглушка) или её скрипт не загрузился —
// скрываем виджет и разблокируем кнопку, иначе заказ невозможно оформить.
// Серверная проверка при заданном HCAPTCHA_SECRET всё равно отклонит запрос без токена.
function _disableHcaptcha() {
  window.HCAPTCHA_DISABLED = true;
  const el = document.querySelector('.h-captcha');
  if (el) {
    const group = el.closest('.form-group');
    (group || el).style.display = 'none';
  }
  const btn = document.getElementById('checkoutSubmitBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Оформить заказ'; }
}

document.addEventListener('DOMContentLoaded', function () {
  const el = document.querySelector('.h-captcha');
  const sitekey = el ? (el.getAttribute('data-sitekey') || '') : '';
  const configured = sitekey && sitekey.indexOf('PLACEHOLDER') === -1;

  if (!configured) {
    _disableHcaptcha();
    return;
  }

  setTimeout(function () {
    if (typeof window.hcaptcha === 'undefined' && !_hcaptchaToken) {
      _disableHcaptcha();
    }
  }, 8000);
});
