/* =========================================================
   Mobile GSM — shared site logic
   (live search, cart storage, add-to-cart wiring)
   ========================================================= */

/* ---------- HTML escaping (XSS defense) ----------
   Anything that ends up inside innerHTML and did not come from a fixed,
   hard-coded string in this codebase (names, addresses, search queries,
   review text, ...) must be escaped first, since it may contain HTML/JS
   from a form field, the URL, or a stored record. */
function escapeHtml(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* ---------- Persian/English digit helpers ---------- */
function faToEn(str){
  const map = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
  return String(str).replace(/[۰-۹]/g, d => map[d]);
}
function enToFa(num){
  return Number(num || 0).toLocaleString('fa-IR');
}
function parsePrice(text){
  const digits = faToEn(text || '').replace(/[^\d]/g, '');
  return parseInt(digits || '0', 10);
}

/* ---------- Product index (for search suggestions) ---------- */
const PRODUCTS = [
  { name:'گوشی سامسونگ Galaxy S24 Ultra', price:68500000, link:'product.html' },
  { name:'گوشی سامسونگ Galaxy A55 5G', price:14200000, link:'/?q=' },
  { name:'گوشی سامسونگ Galaxy A34 5G', price:14200000, link:'/?q=' },
  { name:'گوشی اپل iPhone 13', price:27900000, link:'/?q=' },
  { name:'گوشی اپل iPhone 15 Pro', price:62000000, link:'/?q=' },
  { name:'گوشی شیائومی Redmi Note 13', price:9850000, link:'/?q=' },
  { name:'گوشی شیائومی POCO X6 5G', price:13400000, link:'/?q=' },
  { name:'گوشی شیائومی Redmi 13C', price:7200000, link:'/?q=' },
  { name:'باند بلوتوثی قابل حمل ضدآب', price:790000, link:'/?q=' },
  { name:'باند رومیزی بلوتوثی با نور RGB', price:1250000, link:'/?q=' },
  { name:'باند بلوتوثی مینی جیبی', price:690000, link:'/?q=' },
  { name:'مودم 4G قابل حمل همراه', price:2100000, link:'/?q=' },
  { name:'مودم 4G رومیزی سیم‌کارت‌خور', price:2100000, link:'/?q=' },
  { name:'روتر Wi-Fi خانگی دو‌باند AC1200', price:1450000, link:'/?q=' },
  { name:'هندزفری بی‌سیم بلوتوثی', price:690000, link:'/?q=' },
  { name:'کابل شارژ فست شارژ تایپ سی ۶۵ وات', price:198000, link:'/?q=' },
  { name:'آداپتور شارژر دیواری ۳۳ وات فست شارژ', price:210000, link:'/?q=' },
  { name:'آداپتور شارژر دیواری ۴۵ وات فست شارژ', price:340000, link:'/?q=' },
  { name:'قاب محافظ ضدضربه Galaxy S24 Ultra', price:299000, link:'/?q=' },
];

/* ---------- Live search dropdown (header, all pages) ---------- */
function initSearch(){
  const box = document.querySelector('.search-bar');
  const input = box ? box.querySelector('input') : null;
  if(!box || !input) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'search-dropdown';
  box.appendChild(dropdown);

  function renderDropdown(query){
    const q = query.trim();
    if(!q){ dropdown.classList.remove('open'); dropdown.innerHTML = ''; return; }
    const qLower = q.toLowerCase();
    const matches = PRODUCTS.filter(p => p.name.toLowerCase().indexOf(qLower) !== -1).slice(0, 7);
    if(matches.length === 0){
      dropdown.innerHTML = '<div class="search-empty">نتیجه‌ای برای «' + escapeHtml(q) + '» یافت نشد</div>';
    }else{
      dropdown.innerHTML = matches.map(p => {
        const href = p.link.indexOf('?q=') !== -1
          ? p.link + encodeURIComponent(q) + '#products'
          : p.link;
        return '<a href="' + escapeHtml(href) + '" class="search-item">' +
          '<span>' + escapeHtml(p.name) + '</span><b>' + enToFa(p.price) + ' <i>تومان</i></b></a>';
      }).join('');
    }
    dropdown.classList.add('open');
  }

  input.addEventListener('input', () => renderDropdown(input.value));
  input.addEventListener('focus', () => { if(input.value) renderDropdown(input.value); });
  document.addEventListener('click', e => { if(!box.contains(e.target)) dropdown.classList.remove('open'); });

  function onIndexPage(){
    const p = location.pathname;
    return p.endsWith('index.html') || p === '/' || p.endsWith('/');
  }

  function goSearch(){
    const q = input.value.trim();
    if(!q) return;
    if(onIndexPage()){
      filterGrid(q);
      dropdown.classList.remove('open');
    }else{
      location.href = '/?q=' + encodeURIComponent(q);
    }
  }

  const goBtn = box.querySelector('button');
  if(goBtn) goBtn.addEventListener('click', e => { e.preventDefault(); goSearch(); });
  input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); goSearch(); } });

  if(onIndexPage()){
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if(q){
      input.value = q;
      filterGrid(q);
    }
  }
}

/* ---------- Shop filters + pagination (index page, #products grid) ---------- */
let shopFiltersAPI = null;

function initShopFilters(){
  const grid = document.querySelector('#products .product-grid');
  if(!grid) return null;

  const cards = Array.from(grid.querySelectorAll('.product-card'));
  const catBoxes = Array.from(document.querySelectorAll('.filter-group input[data-filter-type="category"]'));
  const brandBoxes = Array.from(document.querySelectorAll('.filter-group input[data-filter-type="brand"]'));
  const priceRange = document.getElementById('price-range');
  const priceValueEl = document.getElementById('price-range-value');
  const countEl = document.querySelector('.products-toolbar b');
  const loadMoreBtn = document.querySelector('.load-more');
  const PRICE_CAP = 300000000;

  function updatePriceLabel(){
    if(!priceRange || !priceValueEl) return;
    const maxPrice = Math.round((Number(priceRange.value) / 100) * PRICE_CAP);
    priceValueEl.textContent = 'تا ' + enToFa(maxPrice) + ' تومان';
  }

  const PAGE_SIZE = 6;
  const PAGE_STEP = 3;
  let visibleCount = PAGE_SIZE;
  let searchQuery = '';
  let lastMatchCount = cards.length;

  function matchesFilters(card){
    const checkedCats = catBoxes.filter(b => b.checked).map(b => b.dataset.filterValue);
    const checkedBrands = brandBoxes.filter(b => b.checked).map(b => b.dataset.filterValue);
    const maxPrice = priceRange ? (Number(priceRange.value) / 100) * PRICE_CAP : Infinity;

    const catOk = checkedCats.length === 0 || checkedCats.some(c => card.classList.contains('cat-' + c));
    const brandOk = checkedBrands.length === 0 || !card.classList.contains('cat-phone') ||
      checkedBrands.some(b => card.classList.contains('brand-' + b));
    const price = Number(card.dataset.price || 0);
    const priceOk = price <= maxPrice;
    const q = searchQuery.trim().toLowerCase();
    const h3 = card.querySelector('h3');
    const searchOk = !q || (h3 && h3.textContent.toLowerCase().indexOf(q) !== -1);

    return catOk && brandOk && priceOk && searchOk;
  }

  function render(){
    const matched = cards.filter(matchesFilters);
    lastMatchCount = matched.length;

    cards.forEach(card => { card.style.display = 'none'; });
    matched.forEach((card, i) => { card.style.display = i < visibleCount ? '' : 'none'; });

    if(countEl) countEl.textContent = enToFa(matched.length);
    if(loadMoreBtn){
      loadMoreBtn.style.display = (matched.length === 0 || visibleCount >= matched.length) ? 'none' : '';
    }
  }

  [...catBoxes, ...brandBoxes].forEach(box => {
    box.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  });
  if(priceRange){
    priceRange.addEventListener('input', () => { visibleCount = PAGE_SIZE; updatePriceLabel(); render(); });
  }
  if(loadMoreBtn){
    loadMoreBtn.addEventListener('click', () => { visibleCount += PAGE_STEP; render(); });
  }

  updatePriceLabel();
  render();

  return {
    setSearchQuery(q){ searchQuery = q; visibleCount = PAGE_SIZE; render(); },
    getMatchCount(){ return lastMatchCount; }
  };
}

/* ---------- Header search (works with shop filters on #products + simple filter on #deals) ---------- */
function filterGrid(query){
  const q = query.trim();
  const qLower = q.toLowerCase();

  if(shopFiltersAPI) shopFiltersAPI.setSearchQuery(q);

  const dealCards = document.querySelectorAll('#deals .product-card');
  dealCards.forEach(card => {
    const name = card.querySelector('h3') ? card.querySelector('h3').textContent : '';
    const match = !q || name.toLowerCase().indexOf(qLower) !== -1;
    card.style.display = match ? '' : 'none';
  });

  let matchCount = shopFiltersAPI ? shopFiltersAPI.getMatchCount() : 0;
  dealCards.forEach(card => { if(card.style.display !== 'none') matchCount++; });

  let notice = document.getElementById('search-notice');
  const productsCol = document.querySelector('.products-col');
  if(productsCol){
    if(!notice){
      notice = document.createElement('div');
      notice.id = 'search-notice';
      notice.className = 'search-notice';
      productsCol.insertBefore(notice, productsCol.firstChild);
    }
    if(q){
      notice.style.display = 'block';
      notice.textContent = matchCount > 0
        ? 'نتایج جستجو برای «' + q + '» — ' + enToFa(matchCount) + ' محصول یافت شد'
        : 'نتیجه‌ای برای «' + q + '» یافت نشد.';
    }else{
      notice.style.display = 'none';
    }
  }

  const productsSection = document.getElementById('products');
  if(productsSection && q) productsSection.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ---------- Cart storage (server-backed when logged in, localStorage for guests) ---------- */
const CART_KEY = 'mobilegsm_cart';

function getLocalCart(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e){ return []; }
}
function saveLocalCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

async function getCart(){
  const user = await apiGetCurrentUser();
  if(!user) return getLocalCart();
  try{
    const { res, data } = await callApi('/api/cart', {});
    if(res.ok) return data.items || [];
  }catch(e){ /* fall through to local */ }
  return getLocalCart();
}

async function saveCart(cart){
  const user = await apiGetCurrentUser();
  if(user){
    try{
      await callApi('/api/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      });
    }catch(e){ /* best effort */ }
  }else{
    saveLocalCart(cart);
  }
  await updateCartBadge();
}

async function updateCartBadge(){
  const cart = await getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('.cart-btn em').forEach(em => em.textContent = enToFa(count));
}

async function addToCart(item){
  const cart = await getCart();
  const addQty = Math.max(1, parseInt(item.qty, 10) || 1);
  const existing = cart.find(c => c.name === item.name &&
    (c.color || '') === (item.color || '') &&
    (c.storage || '') === (item.storage || ''));
  if(existing){ existing.qty += addQty; }
  else{ cart.push(Object.assign({}, item, { qty: addQty })); }
  await saveCart(cart);
}

function getSelectedOption(groupTitle){
  const groups = Array.from(document.querySelectorAll('.option-group'));
  const group = groups.find(g => {
    const h4 = g.querySelector('h4');
    return h4 && h4.textContent.trim() === groupTitle;
  });
  if(!group) return '';
  const active = group.querySelector('.opt-chip.active');
  return active ? active.textContent.trim() : '';
}

function extractCardData(card){
  const thumb = card.querySelector('.p-thumb');
  const img = thumb ? thumb.querySelector('img') : null;
  const image = img ? img.getAttribute('src') : 'images/phone.svg';
  const colorClass = thumb ? Array.prototype.find.call(thumb.classList, c => c.indexOf('t-') === 0) : 't-teal';
  const name = card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : 'کالای فروشگاه';
  const priceEl = card.querySelector('.p-price b');
  const price = priceEl ? parsePrice(priceEl.textContent) : 0;
  return { name, price, image, colorClass };
}

document.addEventListener('click', async e => {
  const addBtn = e.target.closest('.add-btn');
  const buyBtn = e.target.closest('.buy-now');

  if(addBtn){
    const card = addBtn.closest('.product-card');
    if(card){
      await addToCart(extractCardData(card));
      const original = addBtn.textContent;
      addBtn.textContent = 'اضافه شد ✓';
      addBtn.disabled = true;
      setTimeout(() => { addBtn.textContent = original; addBtn.disabled = false; }, 1200);
    }
  }

  if(buyBtn){
    const gallery = document.querySelector('.gallery-main');
    const galleryImg = document.getElementById('gallery-image');
    const h1 = document.querySelector('.product-info h1');
    const priceEl = document.querySelector('.price-box b');
    const qtyInput = document.querySelector('.qty-box input');
    if(h1 && priceEl){
      const colorClass = gallery ? Array.prototype.find.call(gallery.classList, c => c.indexOf('t-') === 0) : 't-teal';
      const qty = qtyInput ? Math.max(1, parseInt(faToEn(qtyInput.value), 10) || 1) : 1;
      const selectedColor = getSelectedOption('رنگ');
      const selectedStorage = getSelectedOption('حافظه داخلی');
      const baseName = h1.textContent.trim();
      const variantBits = [];
      if(selectedColor) variantBits.push('رنگ: ' + selectedColor);
      if(selectedStorage) variantBits.push('حافظه: ' + selectedStorage);
      const fullName = variantBits.length ? `${baseName} (${variantBits.join(' - ')})` : baseName;
      await addToCart({
        name: fullName,
        price: parsePrice(priceEl.textContent),
        image: galleryImg ? galleryImg.getAttribute('src') : 'images/phone.svg',
        colorClass: colorClass || 't-teal',
        color: selectedColor,
        storage: selectedStorage,
        qty: qty
      });
      if(typeof window.resetProductQty === 'function') window.resetProductQty();
      const original = buyBtn.textContent;
      buyBtn.textContent = 'به سبد اضافه شد ✓';
      setTimeout(() => { buyBtn.textContent = original; }, 1400);
    }
  }
});

/* ---------- Auth (backed by the real server in server.js, not localStorage) ---------- */
const AUTH_API = '/api/auth';
const SERVER_UNREACHABLE_MSG = 'اتصال به سرور برقرار نشد. مطمئن شوید سرور را با دستور «node server.js» اجرا کرده‌اید و سایت را از آدرس http://localhost:3000 باز کرده‌اید (نه با دوبار کلیک روی فایل html).';

async function callAuthApi(path, options){
  let res;
  try{
    res = await fetch(`${AUTH_API}${path}`, { credentials: 'include', ...options });
  }catch(e){
    // fetch itself threw: server not running, wrong origin, CORS, etc.
    throw new Error(SERVER_UNREACHABLE_MSG);
  }

  let data;
  try{
    data = await res.json();
  }catch(e){
    // Response wasn't JSON at all (e.g. a 404 HTML page from a different static server)
    throw new Error(SERVER_UNREACHABLE_MSG);
  }

  return { res, data };
}

async function apiRegister({ firstName, lastName, phone, password }){
  const { res, data } = await callAuthApi('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, phone, password })
  });
  if(!res.ok) throw new Error(data.error || 'خطا در ثبت‌نام');
  return data.user;
}

async function apiLogin(phone, password){
  const { res, data } = await callAuthApi('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  if(!res.ok) throw new Error(data.error || 'خطا در ورود');
  return data.user;
}

async function apiLogout(){
  try{
    await callAuthApi('/logout', { method: 'POST' });
  }catch(e){ /* ignore — logging out should never block the UI */ }
}

async function apiGetCurrentUser(){
  try{
    const { data } = await callAuthApi('/me', {});
    return data.user || null;
  }catch(e){
    return null; // server not running — treat as logged out rather than erroring
  }
}

async function apiUpdateProfile(patch){
  const { res, data } = await callAuthApi('/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if(!res.ok) throw new Error(data.error || 'خطا در به‌روزرسانی اطلاعات');
  return data.user;
}

async function apiForgotRequest(phone){
  const { res, data } = await callAuthApi('/forgot/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  if(!res.ok) throw new Error(data.error || 'خطا در ارسال کد تایید');
  return data; // { ok, devCode } — devCode is a temporary stand-in until a real SMS gateway is connected
}

async function apiForgotVerify(phone, code, newPassword){
  const { res, data } = await callAuthApi('/forgot/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, newPassword })
  });
  if(!res.ok) throw new Error(data.error || 'کد وارد شده نادرست یا منقضی شده است.');
  return data;
}

async function refreshAccountNavLabel(){
  const span = document.querySelector('.header-actions a[href="account.html"] span');
  if(!span) return;
  const user = await apiGetCurrentUser();
  span.textContent = user ? `${user.firstName} ${user.lastName}`.trim() : 'حساب من';
}

/* ---------- Orders (real orders, saved on the server — call apiCreateOrder
   only AFTER a payment gateway confirms the payment succeeded) ---------- */
async function callApi(path, options){
  let res;
  try{
    res = await fetch(path, { credentials: 'include', ...options });
  }catch(e){
    throw new Error(SERVER_UNREACHABLE_MSG);
  }
  let data;
  try{
    data = await res.json();
  }catch(e){
    throw new Error(SERVER_UNREACHABLE_MSG);
  }
  return { res, data };
}

async function apiCreateOrder({ items, address }){
  const { res, data } = await callApi('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, address })
  });
  if(!res.ok) throw new Error(data.error || 'خطا در ثبت سفارش');
  return data.order;
}

async function apiGetMyOrders(){
  try{
    const { res, data } = await callApi('/api/orders/mine', {});
    if(!res.ok) return [];
    return data.orders || [];
  }catch(e){
    return [];
  }
}

async function mergeGuestDataIntoAccount(){
  // Cart: merge quantities for matching items, then adopt the server as the source of truth.
  const localCart = getLocalCart();
  if(localCart.length){
    const serverCart = await getCart();
    localCart.forEach(item => {
      const existing = serverCart.find(c => c.name === item.name);
      if(existing) existing.qty += item.qty;
      else serverCart.push(item);
    });
    await saveCart(serverCart);
    localStorage.removeItem(CART_KEY);
  }

  // Wishlist: merge, skipping duplicates.
  const localWishlist = getLocalWishlist();
  if(localWishlist.length){
    const serverWishlist = await getWishlist();
    localWishlist.forEach(item => {
      if(!serverWishlist.some(w => w.name === item.name)) serverWishlist.push(item);
    });
    await saveWishlist(serverWishlist);
    localStorage.removeItem(WISHLIST_KEY);
  }
}

async function apiGetReviews(productId){
  try{
    const { res, data } = await callApi(`/api/reviews?product=${encodeURIComponent(productId)}`, {});
    if(res.ok) return data.items || [];
  }catch(e){ /* ignore */ }
  return [];
}

async function apiAddReview(productId, { name, text, rating }){
  const { res, data } = await callApi(`/api/reviews?product=${encodeURIComponent(productId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, text, rating })
  });
  if(!res.ok) throw new Error(data.error || 'خطا در ثبت نظر');
  return data.review;
}

/* ---------- Wishlist storage (server-backed when logged in, localStorage for guests) ---------- */
const WISHLIST_KEY = 'mobilegsm_wishlist';

function getLocalWishlist(){
  try{ return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
  catch(e){ return []; }
}
function saveLocalWishlist(list){
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
}

async function getWishlist(){
  const user = await apiGetCurrentUser();
  if(!user) return getLocalWishlist();
  try{
    const { res, data } = await callApi('/api/wishlist', {});
    if(res.ok) return data.items || [];
  }catch(e){ /* fall through to local */ }
  return getLocalWishlist();
}

async function saveWishlist(list){
  const user = await apiGetCurrentUser();
  if(user){
    try{
      await callApi('/api/wishlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: list })
      });
    }catch(e){ /* best effort */ }
  }else{
    saveLocalWishlist(list);
  }
}

async function isInWishlist(name){
  const list = await getWishlist();
  return list.some(w => w.name === name);
}

async function toggleWishlist(item){
  const list = await getWishlist();
  const idx = list.findIndex(w => w.name === item.name);
  if(idx !== -1){
    list.splice(idx, 1);
    await saveWishlist(list);
    return false; // removed
  }
  list.push(item);
  await saveWishlist(list);
  return true; // added
}
function setWishlistBtnState(btn, active){
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی');
}

document.addEventListener('click', async e => {
  const wishBtn = e.target.closest('.wishlist-btn');
  if(!wishBtn) return;

  // Product detail page: read from the product info block
  const h1 = document.querySelector('.product-info h1');
  const priceEl = document.querySelector('.price-box b');
  const galleryImg = document.getElementById('gallery-image');

  // Product card (grid) fallback, in case a wishlist button ever lives on a card
  const card = wishBtn.closest('.product-card');

  let item = null;
  if(h1 && priceEl){
    item = {
      name: h1.textContent.trim(),
      price: parsePrice(priceEl.textContent),
      image: galleryImg ? galleryImg.getAttribute('src') : 'images/phone.svg',
      link: (window.location.pathname.split('/').pop() || 'product.html') + window.location.search
    };
  } else if(card){
    const data = extractCardData(card);
    data.link = 'product.html';
    item = data;
  }

  if(!item) return;

  const added = await toggleWishlist(item);
  setWishlistBtnState(wishBtn, added);
});

document.addEventListener('DOMContentLoaded', async () => {
  updateCartBadge();
  shopFiltersAPI = initShopFilters();
  initSearch();
  refreshAccountNavLabel();

  // Restore wishlist button state on load (product page)
  const h1 = document.querySelector('.product-info h1');
  const wishBtn = document.querySelector('.wishlist-btn');
  if(h1 && wishBtn){
    setWishlistBtnState(wishBtn, await isInWishlist(h1.textContent.trim()));
  }

  const filtersToggle = document.getElementById('filters-toggle');
  const filters = document.getElementById('filters');
  const filtersBackdrop = document.getElementById('filters-backdrop');
  const filtersClose = document.getElementById('filters-close');
  const filtersApply = document.getElementById('filters-apply');

  function openFilters(){
    if(!filters) return;
    filters.classList.add('open');
    if(filtersBackdrop) filtersBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeFilters(){
    if(!filters) return;
    filters.classList.remove('open');
    if(filtersBackdrop) filtersBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (filtersToggle && filters) {
    filtersToggle.addEventListener('click', () => {
      filters.classList.contains('open') ? closeFilters() : openFilters();
    });
  }
  if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFilters);
  if (filtersClose) filtersClose.addEventListener('click', closeFilters);
  if (filtersApply) filtersApply.addEventListener('click', closeFilters);
});
