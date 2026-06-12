// API Configuration
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : `${window.location.protocol}//${window.location.hostname}/api`;

// Корзина
let cart = [];
try {
  const raw = localStorage.getItem('biolab_cart');
  cart = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(cart)) cart = [];
} catch (_) {
  cart = [];
}

// ===== Безопасные хелперы =====

// Безопасный URL для атрибутов (img src, model-viewer src, ссылки):
// разрешаем только http(s) и относительные пути на /uploads/, /images/, /assets/.
function safeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(\/uploads\/|\/images\/|\/assets\/)/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch (_) {}
  }
  return '';
}

// CSS-инъекций не будет: оборачиваем URL в двойные кавычки и %-кодируем
// всё, что не входит в безопасный whitelist URL-символов. encodeURIComponent
// нам не подходит, потому что он не трогает ()*'!~ — а () могут сломать
// `url(...)` контекст. Делаем percent-encode сами.
function safeCssUrl(url) {
  const u = safeUrl(url);
  if (!u) return '';
  const ALLOWED = '-._~:/?#@$&+,;=%';
  let out = '';
  for (const ch of u) {
    const code = ch.codePointAt(0);
    const isAlnum = (code >= 0x30 && code <= 0x39)
                 || (code >= 0x41 && code <= 0x5A)
                 || (code >= 0x61 && code <= 0x7A);
    if (isAlnum || ALLOWED.indexOf(ch) >= 0) {
      out += ch;
    } else if (code < 128) {
      out += '%' + code.toString(16).toUpperCase().padStart(2, '0');
    } else {
      out += encodeURIComponent(ch);
    }
  }
  return out;
}

// Сборка элемента с текстом (без innerHTML)
function el(tag, opts = {}, ...children) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.id) node.id = opts.id;
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v != null) node.setAttribute(k, String(v));
    }
  }
  if (opts.style) {
    for (const [k, v] of Object.entries(opts.style)) node.style[k] = v;
  }
  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) node.dataset[k] = String(v);
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

// ===== Корзина =====

function saveCart() {
  try { localStorage.setItem('biolab_cart', JSON.stringify(cart)); } catch (_) {}
  updateCartUI();
}

function updateCartUI() {
  const cartCount = document.getElementById('cartCount');
  const cartItems = document.getElementById('cartItems');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const emptyCartState = document.getElementById('emptyCartState');
  const cartTotalSection = document.getElementById('cartTotalSection');
  const cartActionsSection = document.getElementById('cartActionsSection');

  if (cartCount) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = String(totalItems);
    cartCount.style.display = totalItems > 0 ? 'inline' : 'none';
  }

  // Показываем пустую корзину или товары
  const isEmpty = cart.length === 0;
  if (emptyCartState) emptyCartState.style.display = isEmpty ? 'block' : 'none';
  if (cartItems) cartItems.style.display = isEmpty ? 'none' : 'block';
  if (cartTotalSection) cartTotalSection.style.display = isEmpty ? 'none' : 'block';
  if (cartActionsSection) cartActionsSection.style.display = isEmpty ? 'none' : 'flex';

  if (!isEmpty) {
    if (cartItems) {
      cartItems.innerHTML = '';
    }
    let total = 0;

    cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;

      if (cartItems) {
        const info = el('div', { className: 'cart-item-info' },
          el('h4', { text: item.title }),
          el('p', { text: `${item.price} ₽ × ${item.quantity} = ${itemTotal} ₽` })
        );

        const minus = el('button', { text: '-', dataset: { action: 'qty-change', index: String(index), delta: '-1' } });
        const qtyText = el('span', { text: String(item.quantity) });
        const plus = el('button', { text: '+', dataset: { action: 'qty-change', index: String(index), delta: '1' } });
        const remove = el('button', {
          className: 'remove-btn',
          text: '×',
          dataset: { action: 'qty-remove', index: String(index) }
        });

        const controls = el('div', { className: 'cart-item-controls' }, minus, qtyText, plus, remove);
        cartItems.appendChild(el('div', { className: 'cart-item' }, info, controls));
      }
    });

    if (cartTotal) cartTotal.textContent = `${total} ₽`;
  }

  if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
}

function addToCart(productId, title, price) {
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    if (existing.quantity < 100) existing.quantity += 1;
  } else {
    cart.push({ productId, title, price, quantity: 1 });
  }
  saveCart();
  showNotification(`${title} добавлен в корзину`);
}

function changeQuantity(index, change) {
  if (!cart[index]) return;
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  if (cart[index] && cart[index].quantity > 100) cart[index].quantity = 100;
  saveCart();
}

function removeFromCart(index) {
  if (!cart[index]) return;
  cart.splice(index, 1);
  saveCart();
}

function clearCart() {
  cart = [];
  saveCart();
}

function showNotification(message) {
  const notification = el('div', { className: 'notification', text: message });
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 300);
  }, 2000);
}

// ===== Загрузка и отображение товаров =====

let allProducts = []; // Храним все товары для фильтрации
let activeCategory = 'all';
let activeSearch = '';

async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}/products`);
    if (!response.ok) throw new Error('Ошибка загрузки товаров');
    const data = await response.json();
    // Поддержка старого формата (массив) и нового ({ products, total, ... })
    allProducts = Array.isArray(data)
      ? data
      : (Array.isArray(data.products) ? data.products : []);
    populateCategoryFilters(allProducts);
    renderProducts(allProducts);
  } catch (error) {
    console.error('Ошибка:',	error);
    showError('Не удалось загрузить товары. Попробуйте обновить страницу.');
  }
}

// Заполняем кнопки категорий
function populateCategoryFilters(products) {
  const container = document.getElementById('categoryFilters');
  if (!container) return;

  // Собираем уникальные категории
  const categories = new Set();
  products.forEach(p => {
    const cat = String(p.category || '').trim();
    if (cat) categories.add(cat);
  });

  if (categories.size === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';

  // Очищаем и добавляем "Все"
  container.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'category-btn active';
  allBtn.dataset.category = 'all';
  allBtn.textContent = 'Все';
  container.appendChild(allBtn);

  // Добавляем категории
  [...categories].sort().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.dataset.category = cat;
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    container.appendChild(btn);
  });
}

// Фильтрация
function filterProducts() {
  let filtered = allProducts;

  // По категории
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p =>
      String(p.category || '').toLowerCase() === activeCategory.toLowerCase()
    );
  }

  // По поиску
  const q = activeSearch.toLowerCase().trim();
  if (q) {
    filtered = filtered.filter(p => {
      const text = (
        String(p.title || '') + ' ' +
        String(p.description || '') + ' ' +
        String(p.category || '')
      ).toLowerCase();
      return text.includes(q);
    });
  }

  renderProducts(filtered);
}

// Навешиваем обработчик на фильтры
function setupCategoryFilters() {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;

    activeCategory = btn.dataset.category || 'all';

    container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    filterProducts();
  });
}

function renderProducts(products) {
  const tilesContainer = document.querySelector('.tiles');
  if (!tilesContainer) return;
  tilesContainer.innerHTML = '';

  if (products.length === 0) {
    tilesContainer.appendChild(
      el('p', { style: { textAlign: 'center', width: '100%', padding: '40px' }, text: 'Товары пока не добавлены' })
    );
    return;
  }

  let modelCounter = 0;
  const apiBase = API_URL.replace('/api', '');

  products.forEach((product) => {
    modelCounter++;
    const sizeClass = product.size === 'wide' ? 'size-wide'
                    : product.size === 'large' ? 'size-large' : '';

    const title = String(product.title || '');
    const description = String(product.description || '');
    const category = String(product.category || '');
    const price = parseInt(product.price, 10) || 0;
    const stock = parseInt(product.stock, 10) || 0;

    // Безопасные URL
    let imgUrl = '';
    if (typeof product.imageUrl === 'string' && product.imageUrl) {
      imgUrl = product.imageUrl.startsWith('http')
        ? safeUrl(product.imageUrl)
        : safeUrl(`${apiBase}${product.imageUrl}`);
    }
    const modelUrl = product.modelUrl ? safeUrl(product.modelUrl) : '';

    // Caption для Fancybox — текст-only, чтобы не пробовать инжектить HTML
    const captionLines = [title];
    if (description) captionLines.push('', description);
    captionLines.push('', `Цена: ${price} ₽`);
    captionLines.push(stock > 0 ? `В наличии: ${stock} шт.` : 'Нет в наличии');
    const captionText = captionLines.join('\n');

    const article = el('article', {
      className: sizeClass,
      attrs: {
        'data-search': (title + ' ' + description + ' ' + category).toLowerCase(),
        'data-product-id': String(product._id || ''),
        'data-category': category.toLowerCase()
      }
    });

    // Фон карточки
    const bg = el('span', { className: 'image' });
    bg.style.cssText = 'display:block;position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;background-size:cover;background-position:center;';
    if (imgUrl) bg.style.backgroundImage = `url("${safeCssUrl(imgUrl)}")`;
    article.appendChild(bg);

    // Overlay для клика (без Fancybox)
    const overlay = el('div', {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: '1',
        cursor: 'pointer'
      }
    });

    overlay.appendChild(el('h2', { text: title }));
    const content = el('div', { className: 'content' });
    if (description) {
      const lines = description.split(/\r\n|\r|\n/);
      const p = document.createElement('p');
      lines.forEach((line, i) => {
        if (i > 0) p.appendChild(document.createElement('br'));
        p.appendChild(document.createTextNode(line));
      });
      content.appendChild(p);
    }
    overlay.appendChild(content);
    article.appendChild(overlay);

    // Бейдж наличия
    const stockBadge = document.createElement('div');
    stockBadge.className = `stock-badge ${stock > 0 ? 'in-stock' : 'out-of-stock'}`;
    stockBadge.textContent = stock > 0 ? `В наличии: ${stock} шт.` : 'Нет в наличии';
    article.appendChild(stockBadge);

    // Бейдж с ценой
    article.appendChild(el('div', { className: 'price-badge', text: `${price} ₽` }));

    // Кнопка "В корзину"
    const btnWrap = el('div');
    btnWrap.style.cssText = 'position:absolute;bottom:20px;left:20px;right:20px;z-index:2;';
    let cartBtn;
    if (stock > 0) {
      cartBtn = el('button', {
        className: 'add-to-cart-btn',
        text: 'В корзину',
        dataset: {
          action: 'add-to-cart',
          id: String(product._id || ''),
          title,
          price: String(price)
        }
      });
    } else {
      cartBtn = el('button', { className: 'add-to-cart-btn', text: 'Нет в наличии' });
      cartBtn.disabled = true;
      cartBtn.style.cssText = 'opacity:0.5;cursor:not-allowed;';
    }
    btnWrap.appendChild(cartBtn);
    article.appendChild(btnWrap);

    // 3D-модель — собираем элементами, src ставим через setAttribute (без HTML-парсинга)
    if (modelUrl) {
      const modelContainer = el('div', { id: `model-${modelCounter}`, className: 'model-container' });
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', modelUrl);
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('ar', '');
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
      modelContainer.appendChild(mv);
      article.appendChild(modelContainer);
    }

    tilesContainer.appendChild(article);
  });

  // Снимаем шаблонные обработчики Fancybox с карточек


  // Отключаем Fancybox для карточек (открываем свою модалку)
  if (typeof Fancybox !== 'undefined') Fancybox.destroy();
}

// ===== Модалки и оформление заказа =====

function openCart() {
  const modal = document.getElementById('cartModal');
  if (!modal) return;
  modal.style.display = 'flex';
  updateCartUI();
}

function closeCart() {
  const modal = document.getElementById('cartModal');
  if (modal) modal.style.display = 'none';
}

function openCheckout() {
  if (cart.length === 0) {
    alert('Корзина пуста');
    return;
  }
  closeCart();
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;

  const orderItems = document.getElementById('checkoutItems');
  const orderTotal = document.getElementById('checkoutTotal');
  if (orderItems) orderItems.innerHTML = '';
  let total = 0;

  cart.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    if (orderItems) {
      const line = el('div', { className: 'checkout-item' },
        el('span', { text: `${item.title} × ${item.quantity}` }),
        el('span', { text: `${itemTotal} ₽` })
      );
      orderItems.appendChild(line);
    }
  });

  if (orderTotal) orderTotal.textContent = `${total} ₽`;
  modal.style.display = 'flex';
}

function closeCheckout() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('checkoutForm');
  if (form) form.reset();
}

async function submitOrder(event) {
  event.preventDefault();
  if (cart.length === 0) { alert('Корзина пуста'); return; }

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Отправка...'; }

  const customerName = (form.customerName?.value || '').trim();
  const customerPhone = (form.customerPhone?.value || '').trim();

  // Собираем hCaptcha токен (из глобального callback)
  let hcaptchaToken = '';
  if (typeof getHcaptchaToken === 'function') {
    hcaptchaToken = getHcaptchaToken() || '';
  }

  if (!hcaptchaToken && !window.HCAPTCHA_DISABLED) {
    alert('Пожалуйста, пройдите проверку hCaptcha');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Оформить заказ'; }
    return;
  }

  const formData = {
    customerName,
    customerPhone,
    items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    'h-captcha-response': hcaptchaToken
  };

  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = result && result.message ? result.message : 'Ошибка создания заказа';
      throw new Error(msg);
    }
    showOrderSuccess(result.order);
    closeCheckout();
    clearCart();
  } catch (error) {
    console.error('Ошибка:', error);
    alert(error.message || 'Не удалось создать заказ. Попробуйте ещё раз.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Оформить заказ'; }
  }
}

function showOrderSuccess(order) {
  const modal = document.getElementById('successModal');
  if (!modal) return;
  const codeEl = document.getElementById('orderCode');
  const totalEl = document.getElementById('orderTotal');
  const qrContainer = document.getElementById('orderQRContainer');
  const qrImg = document.getElementById('orderQR');

  if (codeEl) codeEl.textContent = String(order.orderCode || '');
  if (totalEl) totalEl.textContent = `${order.totalAmount || 0} ₽`;

  // Показываем QR если есть
  if (qrContainer && qrImg && order.qrCode) {
    qrImg.src = order.qrCode;
    qrContainer.style.display = 'block';
  } else if (qrContainer) {
    qrContainer.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.style.display = 'none';
}

function showError(message) {
  const tilesContainer = document.querySelector('.tiles');
  if (!tilesContainer) return;
  tilesContainer.innerHTML = '';
  const p = el('p', { text: message });
  p.style.cssText = 'text-align:center;width:100%;padding:40px;color:#ff6b6b;';
  tilesContainer.appendChild(p);
}

// ===== КАРТОЧКА ТОВАРА =====
let currentProductIndex = 0;
let currentSlideIndex = 0;
let touchStartX = 0;
let touchStartY = 0;

function openProductModal(productIndex) {
  const modal = document.getElementById('productModal');
  if (!modal) return;

  currentProductIndex = productIndex;
  currentSlideIndex = 0;
  const product = allProducts[productIndex];
  if (!product) return;

  renderProductModal(product);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function renderProductModal(product) {
  const apiBase = API_URL.replace('/api', '');

  // Собираем массив медиа (фото + 3D)
  const media = [];

  // Фото из массива images или imageUrl
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.imageUrl ? [product.imageUrl] : []);

  images.forEach(img => {
    let url = img;
    if (!url.startsWith('http')) url = apiBase + url;
    media.push({ type: 'image', url: safeUrl(url) });
  });

  // 3D модель
  if (product.modelUrl) {
    media.push({ type: 'model', url: safeUrl(product.modelUrl) });
  }

  // Заголовок и инфо
  const titleEl = document.getElementById('productModalTitle');
  const catEl = document.getElementById('productModalCategory');
  const stockEl = document.getElementById('productModalStock');
  const priceEl = document.getElementById('productModalPrice');
  const descEl = document.getElementById('productModalDesc');
  const cartBtn = document.getElementById('productModalCartBtn');

  if (titleEl) titleEl.textContent = product.title || '';
  if (catEl) catEl.textContent = product.category || '';

  const stock = parseInt(product.stock, 10) || 0;
  if (stockEl) {
    stockEl.className = `product-modal-stock ${stock > 0 ? 'in-stock' : 'out-of-stock'}`;
    stockEl.textContent = '';
    if (stock > 0) {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '16'); icon.setAttribute('height', '16');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'currentColor');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M20 6L9 17l-5-5 1.41-1.41L9 14.17 18.59 4.59 20 6z');
      icon.appendChild(path); stockEl.appendChild(icon);
      stockEl.appendChild(document.createTextNode(` В наличии: ${stock} шт.`));
    } else {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '16'); icon.setAttribute('height', '16');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'currentColor');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      icon.appendChild(path); stockEl.appendChild(icon);
      stockEl.appendChild(document.createTextNode(' Нет в наличии'));
    }
  }

  if (priceEl) priceEl.textContent = `${parseInt(product.price, 10) || 0} ₽`;
  if (descEl) descEl.textContent = product.description || '';

  if (cartBtn) {
    if (stock > 0) {
      cartBtn.disabled = false;
      cartBtn.textContent = 'В корзину';
      cartBtn.dataset.id = product._id || '';
      cartBtn.dataset.title = product.title || '';
      cartBtn.dataset.price = String(parseInt(product.price, 10) || 0);
    } else {
      cartBtn.disabled = true;
      cartBtn.textContent = 'Нет в наличии';
    }
  }

  // Галерея
  renderProductGallery(media);
}

function renderProductGallery(media) {
  const viewport = document.getElementById('productModalGallery');
  const thumbs = document.getElementById('productModalThumbs');
  if (!viewport) return;

  // Очищаем
  viewport.innerHTML = '';
  if (thumbs) thumbs.innerHTML = '';

  if (media.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'product-gallery-slide';
    const msg = document.createElement('div');
    msg.style.cssText = 'color:#555;padding:40px;';
    msg.textContent = 'Нет фото';
    empty.appendChild(msg);
    viewport.appendChild(empty);
    return;
  }

  // Создаём слайдер
  const slidesContainer = document.createElement('div');
  slidesContainer.className = 'product-gallery-slides';
  slidesContainer.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

  media.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'product-gallery-slide';

    if (item.type === 'model') {
      const mv = document.createElement('model-viewer');
      mv.src = item.url;
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('ar', '');
      mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
      slide.appendChild(mv);
    } else {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = 'Фото товара';
      slide.appendChild(img);
    }

    slidesContainer.appendChild(slide);
  });

  viewport.appendChild(slidesContainer);

  // Миниатюры
  if (thumbs) {
    media.forEach((item, idx) => {
      const thumb = document.createElement('div');
      thumb.className = `product-gallery-thumb ${idx === currentSlideIndex ? 'active' : ''}`;
      thumb.dataset.index = idx;

      if (item.type === 'model') {
        thumb.classList.add('model-thumb');
        thumb.classList.add('model-thumb');
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('viewBox','0 0 24 24');
        svg.setAttribute('fill','currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d','M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z');
        svg.appendChild(path);
        thumb.appendChild(svg);
      } else {
        const img = document.createElement('img');
        img.src = item.url;
        thumb.appendChild(img);
      }

      thumb.addEventListener('click', () => {
        currentSlideIndex = idx;
        slidesContainer.style.transform = `translateX(-${idx * 100}%)`;
        thumbs.querySelectorAll('.product-gallery-thumb').forEach((t, i) => {
          t.classList.toggle('active', i === idx);
        });
      });

      thumbs.appendChild(thumb);
    });
  }

  // Touch events для свайпа
  viewport.onclick = null;
  viewport.addEventListener('touchstart', onGalleryTouchStart, { passive: true });
  viewport.addEventListener('touchmove', onGalleryTouchMove, { passive: true });
  viewport.addEventListener('touchend', onGalleryTouchEnd, { passive: true });

  // Клик на слайд = следующий (если больше 1)
  if (media.length > 1) {
    viewport.addEventListener('click', (e) => {
      if (Math.abs(touchDeltaX) < 10) {
        currentSlideIndex = (currentSlideIndex + 1) % media.length;
        slidesContainer.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
        updateThumbs();
      }
    });
  }
}

let touchDeltaX = 0;

function onGalleryTouchStart(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchDeltaX = 0;
}

function onGalleryTouchMove(e) {
  touchDeltaX = e.touches[0].clientX - touchStartX;
}

function onGalleryTouchEnd(e) {
  const threshold = 50;
  const media = getCurrentProductMedia();

  if (touchDeltaX < -threshold && media.length > 1) {
    // Свайп влево = следующий
    currentSlideIndex = Math.min(currentSlideIndex + 1, media.length - 1);
    updateGallerySlide();
  } else if (touchDeltaX > threshold && media.length > 1) {
    // Свайп вправо = предыдущий
    currentSlideIndex = Math.max(currentSlideIndex - 1, 0);
    updateGallerySlide();
  }

  touchDeltaX = 0;
}

function getCurrentProductMedia() {
  const product = allProducts[currentProductIndex];
  if (!product) return [];

  const apiBase = API_URL.replace('/api', '');
  const media = [];
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.imageUrl ? [product.imageUrl] : []);

  images.forEach(img => {
    let url = img;
    if (!url.startsWith('http')) url = apiBase + url;
    media.push({ type: 'image', url: safeUrl(url) });
  });

  if (product.modelUrl) {
    media.push({ type: 'model', url: safeUrl(product.modelUrl) });
  }

  return media;
}

function updateGallerySlide() {
  const slidesContainer = document.querySelector('.product-gallery-slides');
  const thumbs = document.getElementById('productModalThumbs');

  if (slidesContainer) {
    slidesContainer.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  }

  if (thumbs) {
    thumbs.querySelectorAll('.product-gallery-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === currentSlideIndex);
    });
  }
}

function updateThumbs() {
  const thumbs = document.getElementById('productModalThumbs');
  if (thumbs) {
    thumbs.querySelectorAll('.product-gallery-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === currentSlideIndex);
    });
  }
}

function navigateProduct(direction) {
  const newIndex = (currentProductIndex + direction + allProducts.length) % allProducts.length;
  currentProductIndex = newIndex;
  currentSlideIndex = 0;
  renderProductModal(allProducts[newIndex]);
}

// Клик на карточку товара (добавить в renderProducts)
function setupCardClicks() {
  document.addEventListener('click', (e) => {
    const article = e.target.closest('.tiles article');
    if (!article) return;

    // Игнорируем клик на кнопку "В корзину"
    if (e.target.closest('[data-action="add-to-cart"]')) return;

    const productId = article.dataset.productId;
    if (!productId) return;

    const idx = allProducts.findIndex(p => String(p._id) === productId);
    if (idx >= 0) {
      openProductModal(idx);
    }
  });
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  searchInput.addEventListener('input', function () {
    activeSearch = this.value;
    filterProducts();
  });
}

// ===== Делегированные обработчики (без inline onclick) =====

function setupHandlers() {
  // Глобальный делегат кликов для data-action
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
      case 'add-to-cart': {
        const id = target.dataset.id || '';
        const title = target.dataset.title || '';
        const price = parseInt(target.dataset.price, 10) || 0;
        if (id && title) addToCart(id, title, price);
        break;
      }
      case 'qty-change': {
        const index = parseInt(target.dataset.index, 10);
        const delta = parseInt(target.dataset.delta, 10);
        if (Number.isFinite(index) && Number.isFinite(delta)) changeQuantity(index, delta);
        break;
      }
      case 'qty-remove': {
        const index = parseInt(target.dataset.index, 10);
        if (Number.isFinite(index)) removeFromCart(index);
        break;
      }
      case 'open-cart': openCart(); break;
      case 'close-cart': closeCart(); break;
      case 'open-checkout': openCheckout(); break;
      case 'close-checkout': closeCheckout(); break;
      case 'close-success': closeSuccessModal(); break;
      case 'clear-cart': clearCart(); break;
      case 'close-product': closeProductModal(); break;
      case 'product-prev': navigateProduct(-1); break;
      case 'product-next': navigateProduct(1); break;
    }
  });

  // Submit формы заказа
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) checkoutForm.addEventListener('submit', submitOrder);

  // Закрытие модалок по клику вне их
  window.addEventListener('click', (event) => {
    const cartModal = document.getElementById('cartModal');
    const checkoutModal = document.getElementById('checkoutModal');
    const successModal = document.getElementById('successModal');
    const productModal = document.getElementById('productModal');
    if (event.target === cartModal) closeCart();
    if (event.target === checkoutModal) closeCheckout();
    if (event.target === successModal) closeSuccessModal();
    if (event.target === productModal) closeProductModal();
  });

  // Esc — закрыть текущую модалку
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeCart(); closeCheckout(); closeSuccessModal(); closeProductModal();
  });

  // Стрелки для навигации по товарам
  document.addEventListener('keydown', (event) => {
    const productModal = document.getElementById('productModal');
    if (!productModal.classList.contains('open')) return;
    if (event.key === 'ArrowLeft') navigateProduct(-1);
    if (event.key === 'ArrowRight') navigateProduct(1);
  });

  // Клик на карточки товаров
  setupCardClicks();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  setupHandlers();
  setupCategoryFilters();
  loadProducts();
  setupSearch();
  updateCartUI();

  // Sticky header on scroll
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }
});
