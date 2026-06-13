// API Configuration.
// Используем window.location.origin — он включает протокол, хост И порт,
// поэтому доступ по LAN-IP с портом (http://192.168.x.x:3000) тоже работает.
const API_URL = `${window.location.origin}/api`;

// Корзина. Валидируем каждую позицию при загрузке: битый JSON, чужие/старые
// записи или некорректные числа не должны ломать витрину и оформление заказа.
let cart = [];
try {
  const raw = localStorage.getItem('biolab_cart');
  const parsed = raw ? JSON.parse(raw) : [];
  if (Array.isArray(parsed)) {
    cart = parsed
      .filter(it => it && typeof it.productId === 'string' && it.productId)
      .map(it => ({
        productId: it.productId,
        title: String(it.title || ''),
        price: Number.isFinite(Number(it.price)) ? Number(it.price) : 0,
        quantity: Math.min(Math.max(Math.floor(Number(it.quantity)) || 1, 1), 100)
      }));
  }
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

// Действующая цена с учётом акции.
// Акция активна, если задана salePrice (< обычной) и текущая дата в окне saleStart..saleEnd
// (любая из границ опциональна). Возвращает { price, oldPrice|null, onSale }.
function effectivePrice(product) {
  const base = parseInt(product.price, 10) || 0;
  const sale = product.salePrice == null ? null : Number(product.salePrice);
  if (sale == null || !Number.isFinite(sale) || sale <= 0 || sale >= base) {
    return { price: base, oldPrice: null, onSale: false };
  }
  const now = Date.now();
  const start = product.saleStart ? Date.parse(product.saleStart) : null;
  const end = product.saleEnd ? Date.parse(product.saleEnd) : null;
  if (start && Number.isFinite(start) && now < start) return { price: base, oldPrice: null, onSale: false };
  if (end && Number.isFinite(end) && now > end) return { price: base, oldPrice: null, onSale: false };
  return { price: Math.round(sale), oldPrice: base, onSale: true };
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
    // Кружок свёрстан на display:flex (центрирование цифры) — не перетираем на inline,
    // иначе бейдж теряет форму. Управляем видимостью через класс.
    cartCount.classList.toggle('is-hidden', totalItems === 0);
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

// ===== Умный поиск: опечатки, раскладка, транслит, английский =====

// Раскладка ЙЦУКЕН ↔ QWERTY (по физическим клавишам)
const RU_LAYOUT = {
  q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з','[':'х',']':'ъ',
  a:'ф',s:'ы',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',';':'ж',"'":'э',
  z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь',',':'б','.':'ю'
};
const EN_LAYOUT = {};
for (const [en, ru] of Object.entries(RU_LAYOUT)) EN_LAYOUT[ru] = en;

function enLayoutToRu(s) { return s.replace(/[a-z;'\[\],.]/gi, ch => RU_LAYOUT[ch.toLowerCase()] || ch); }
function ruLayoutToEn(s) { return s.replace(/[а-яё]/gi, ch => EN_LAYOUT[ch.toLowerCase()] || ch); }

// Транслитерация кириллица → латиница (для нормализации обеих сторон)
const TRANSLIT = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i',
  'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
  'у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
  'э':'e','ю':'yu','я':'ya'
};
function translit(s) { return s.split('').map(c => (TRANSLIT[c] !== undefined ? TRANSLIT[c] : c)).join(''); }

// Нормализация: lowercase → транслит → только [a-z0-9]
function normSearch(s) { return translit(String(s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ''); }

// Словарь синонимов/перевода (домен: растения и категории)
const SEARCH_SYNONYMS = {
  flower:'цветы', flowers:'цветы', bloom:'цветы',
  vegetable:'овощи', vegetables:'овощи', veggie:'овощи', veggies:'овощи',
  green:'зелень', greens:'зелень', herb:'зелень', herbs:'зелень', greenery:'зелень',
  seedling:'рассада', seedlings:'рассада', sprout:'рассада', sprouts:'рассада',
  shrub:'кустарники', shrubs:'кустарники', bush:'кустарники', bushes:'кустарники',
  tree:'деревья', trees:'деревья',
  seed:'семена', seeds:'семена',
  dill:'укроп', basil:'базилик', tomato:'помидор', tomatoes:'помидор',
  cucumber:'огурец', cucumbers:'огурец', pepper:'перец', peppers:'перец',
  sunflower:'подсолнух', chamomile:'ромашка', daisy:'ромашка',
  violet:'фиалка', hydrangea:'гортензия', apple:'яблоня', appletree:'яблоня'
};
function translateWords(s) {
  return s.toLowerCase().split(/\s+/).map(w => SEARCH_SYNONYMS[w] || w).join(' ');
}

// Расстояние Левенштейна (для опечаток), с отсечкой по длине
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}

// Главный матчер: терпим к опечаткам, раскладке, транслиту, английскому
function smartMatch(rawQuery, product) {
  const q0 = String(rawQuery || '').trim().toLowerCase();
  if (!q0) return true;

  // Варианты запроса: как есть, смена раскладки в обе стороны, перевод EN→RU
  const variants = new Set([
    q0,
    enLayoutToRu(q0),
    ruLayoutToEn(q0),
    translateWords(q0),
    translateWords(enLayoutToRu(q0))
  ]);

  // Нормализуем варианты в токены (латиница)
  const queryTokens = [];
  for (const v of variants) {
    for (const w of v.split(/\s+/)) {
      const nw = normSearch(w);
      if (nw) queryTokens.push(nw);
    }
  }
  if (!queryTokens.length) return true;

  const rawHay = `${product.title || ''} ${product.description || ''} ${product.category || ''}`;
  const hayFull = normSearch(rawHay);
  const hayWords = rawHay.toLowerCase().split(/\s+/).map(normSearch).filter(Boolean);

  return queryTokens.some(qt => {
    if (qt.length < 2) return hayFull.includes(qt);
    if (hayFull.includes(qt)) return true; // точное вхождение (с учётом транслита)
    // Нечёткое: опечатки в пределах допуска по словам
    const tol = qt.length <= 4 ? 1 : 2;
    return hayWords.some(hw => {
      if (hw.includes(qt) || qt.includes(hw)) return true;
      if (Math.abs(hw.length - qt.length) > tol) return false;
      return levenshtein(qt, hw) <= tol;
    });
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

  // По поиску (умный матчер)
  if (activeSearch.trim()) {
    filtered = filtered.filter(p => smartMatch(activeSearch, p));
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

  // Отдельный элемент-подсказка для пустого поиска (если есть в разметке)
  const searchEmptyMsg = document.getElementById('searchEmptyMsg');
  const isSearching = activeSearch.trim() !== '' || activeCategory !== 'all';

  if (products.length === 0) {
    if (isSearching && searchEmptyMsg) {
      // Пусто из-за фильтра/поиска — показываем спец-подсказку
      searchEmptyMsg.style.display = 'block';
    } else {
      tilesContainer.appendChild(
        el('p', { style: { textAlign: 'center', width: '100%', padding: '40px' }, text: 'Товары пока не добавлены' })
      );
    }
    return;
  }
  if (searchEmptyMsg) searchEmptyMsg.style.display = 'none';

  let modelCounter = 0;
  const apiBase = API_URL.replace('/api', '');

  products.forEach((product) => {
    modelCounter++;
    const sizeClass = product.size === 'wide' ? 'size-wide'
                    : product.size === 'large' ? 'size-large' : '';

    const title = String(product.title || '');
    const description = String(product.description || '');
    const category = String(product.category || '');
    const pricing = effectivePrice(product);
    const price = pricing.price;
    const stock = parseInt(product.stock, 10) || 0;

    // Безопасный URL картинки
    let imgUrl = '';
    if (typeof product.imageUrl === 'string' && product.imageUrl) {
      imgUrl = product.imageUrl.startsWith('http')
        ? safeUrl(product.imageUrl)
        : safeUrl(`${apiBase}${product.imageUrl}`);
    }

    const article = el('article', {
      className: ('product-card ' + sizeClass).trim(),
      attrs: {
        'data-search': (title + ' ' + description + ' ' + category).toLowerCase(),
        'data-product-id': String(product._id || ''),
        'data-category': category.toLowerCase()
      }
    });

    // ── Медиа (фото сверху) ──
    const media = el('div', { className: 'product-card__media' });
    if (imgUrl) {
      media.style.backgroundImage = `url("${safeCssUrl(imgUrl)}")`;
    } else {
      media.classList.add('product-card__media--empty');
      media.appendChild(el('span', { className: 'product-card__leaf', text: '🌿' }));
    }
    // бейдж наличия (угол)
    media.appendChild(el('span', {
      className: `stock-badge ${stock > 0 ? 'in-stock' : 'out-of-stock'}`,
      text: stock > 0 ? `В наличии: ${stock} шт.` : 'Нет в наличии'
    }));
    // бейдж скидки
    if (pricing.onSale && pricing.oldPrice) {
      const off = Math.round((1 - price / pricing.oldPrice) * 100);
      media.appendChild(el('span', { className: 'sale-badge', text: `-${off}%` }));
    }
    article.appendChild(media);

    // ── Контент (снизу) ──
    const body = el('div', { className: 'product-card__body' });
    if (category) body.appendChild(el('span', { className: 'product-card__cat', text: category }));
    body.appendChild(el('h2', { className: 'product-card__title', text: title }));

    const priceRow = el('div', { className: 'product-card__price' });
    if (pricing.onSale && pricing.oldPrice) {
      priceRow.appendChild(el('span', { className: 'price-old', text: `${pricing.oldPrice} ₽` }));
      priceRow.appendChild(el('span', { className: 'price-new', text: `${price} ₽` }));
    } else {
      priceRow.appendChild(el('span', { className: 'price-cur', text: `${price} ₽` }));
    }
    body.appendChild(priceRow);

    // Кнопка "В корзину" (data-action сохранён для делегата)
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
    }
    body.appendChild(cartBtn);

    article.appendChild(body);
    tilesContainer.appendChild(article);
  });

  // Fancybox для карточек не используем — открываем свою модалку
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

  if (codeEl) codeEl.textContent = String(order.orderCode || '');
  if (totalEl) totalEl.textContent = `${order.totalAmount || 0} ₽`;

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

  const modalPricing = effectivePrice(product);
  if (priceEl) {
    priceEl.textContent = '';
    if (modalPricing.onSale) {
      priceEl.appendChild(el('span', { className: 'price-old', text: `${modalPricing.oldPrice} ₽` }));
      priceEl.appendChild(document.createTextNode(' '));
      priceEl.appendChild(el('span', { className: 'price-new', text: `${modalPricing.price} ₽` }));
    } else {
      priceEl.textContent = `${modalPricing.price} ₽`;
    }
  }
  if (descEl) descEl.textContent = product.description || '';

  if (cartBtn) {
    if (stock > 0) {
      cartBtn.disabled = false;
      cartBtn.textContent = 'В корзину';
      cartBtn.dataset.id = product._id || '';
      cartBtn.dataset.title = product.title || '';
      cartBtn.dataset.price = String(modalPricing.price);
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

  // Touch events для свайпа. Снимаем прошлые слушатели перед навешиванием,
  // иначе при каждом открытии модалки они накапливаются и один клик
  // перелистывает сразу несколько слайдов.
  if (viewport._galleryHandlers) {
    const h = viewport._galleryHandlers;
    viewport.removeEventListener('touchstart', h.start);
    viewport.removeEventListener('touchmove', h.move);
    viewport.removeEventListener('touchend', h.end);
    viewport.removeEventListener('click', h.click);
  }

  const clickHandler = (e) => {
    if (media.length > 1 && Math.abs(touchDeltaX) < 10) {
      currentSlideIndex = (currentSlideIndex + 1) % media.length;
      slidesContainer.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
      updateThumbs();
    }
  };

  viewport.addEventListener('touchstart', onGalleryTouchStart, { passive: true });
  viewport.addEventListener('touchmove', onGalleryTouchMove, { passive: true });
  viewport.addEventListener('touchend', onGalleryTouchEnd, { passive: true });
  viewport.addEventListener('click', clickHandler);

  viewport._galleryHandlers = {
    start: onGalleryTouchStart,
    move: onGalleryTouchMove,
    end: onGalleryTouchEnd,
    click: clickHandler
  };
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
