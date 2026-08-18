// Standalone admin panel script — intentionally does not depend on site.js,
// since this page has nothing to do with the shopper-facing cart/account flow.

const ADMIN_API = '/api/admin';
const MIN_LOADING_MS = 5000; // deliberate minimum spinner time, as requested

function toFa(n){ return Number(n || 0).toLocaleString('fa-IR'); }

// This page intentionally doesn't load site.js, so it needs its own copy of
// the same escaping helper. Every piece of order/user data rendered below
// (names, addresses, item names, emails, ...) is customer-controlled input
// that gets JSON-persisted and later dropped into innerHTML here — without
// escaping, a shopper could put a script in e.g. their name or shipping
// address and have it execute in the admin's browser session.
function escapeHtml(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function formatDate(iso){
  try{
    return new Date(iso).toLocaleString('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }catch(e){ return iso || ''; }
}

function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function adminApi(path, options){
  let res;
  try{
    res = await fetch(`${ADMIN_API}${path}`, { credentials: 'include', ...options });
  }catch(e){
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شوید سرور با «node server.js» در حال اجراست.');
  }
  let data;
  try{ data = await res.json(); }
  catch(e){ throw new Error('پاسخ نامعتبر از سرور دریافت شد.'); }
  return { res, data };
}

const loginWrap   = document.getElementById('admin-login-wrap');
const dashboard   = document.getElementById('admin-dashboard');
const loginForm   = document.getElementById('admin-login-form');
const loginError  = document.getElementById('admin-login-error');
const logoutBtn   = document.getElementById('admin-logout-btn');

function showLoggedIn(){
  loginWrap.style.display = 'none';
  dashboard.style.display = '';
  logoutBtn.style.display = '';
  loadOrders();
  loadUsers();
}
function showLoggedOut(){
  loginWrap.style.display = 'flex';
  dashboard.style.display = 'none';
  logoutBtn.style.display = 'none';
}

async function forceFreshLogin(){
  // Always require the admin to log in again on every visit — don't
  // auto-restore a previous session, even if a valid one still exists.
  try{ await adminApi('/logout', { method: 'POST' }); }catch(e){ /* ignore */ }
  showLoggedOut();
}

if (loginForm){
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    try{
      const { res, data } = await adminApi('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error(data.error || 'ورود ناموفق بود.');
      loginForm.reset();
      showLoggedIn();
    }catch(err){
      loginError.textContent = err.message || 'ورود ناموفق بود.';
    }
  });
}

if (logoutBtn){
  logoutBtn.addEventListener('click', async () => {
    try{ await adminApi('/logout', { method: 'POST' }); }catch(e){ /* ignore */ }
    showLoggedOut();
  });
}

// ---------------- Tabs ----------------
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('admin-panel-orders').style.display = (target === 'orders') ? '' : 'none';
    document.getElementById('admin-panel-users').style.display = (target === 'users') ? '' : 'none';
    document.getElementById('admin-panel-cache').style.display = (target === 'cache') ? '' : 'none';
  });
});

// ---------------- Orders ----------------
const ORDER_STATUSES = ['در حال پردازش', 'در حال ارسال', 'تحویل شده'];

function statusClass(status){
  if (status === 'تحویل شده') return 'done';
  if (status === 'در حال ارسال') return 'shipping';
  return 'pending';
}

function statusSelectHtml(orderId, current){
  const options = ORDER_STATUSES.map(s =>
    `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`
  ).join('');
  return `<select class="status-select ${statusClass(current)}" data-order-id="${escapeHtml(orderId)}">${options}</select>`;
}

async function loadOrders(){
  const loadingEl = document.getElementById('orders-admin-loading');
  const emptyEl = document.getElementById('orders-admin-empty');
  const tableEl = document.getElementById('orders-admin-table');
  const tbody = document.getElementById('orders-admin-tbody');

  emptyEl.style.display = 'none';
  tableEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try{
    const [{ res, data }] = await Promise.all([ adminApi('/orders', {}), wait(MIN_LOADING_MS) ]);
    loadingEl.style.display = 'none';

    if (!res.ok){
      if (res.status === 401) showLoggedOut();
      return;
    }
    const orders = data.orders || [];

    if (!orders.length){
      emptyEl.style.display = 'block';
      return;
    }
    tableEl.style.display = '';

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>${escapeHtml(o.id)}</td>
        <td>${escapeHtml(o.fullName)}</td>
        <td dir="ltr">${escapeHtml(o.phone)}</td>
        <td class="wrap">${escapeHtml(o.address)}</td>
        <td class="wrap">${o.items.map(it => `${escapeHtml(it.name)} × ${toFa(it.qty)}`).join('، ')}</td>
        <td>${toFa(o.total)} تومان</td>
        <td>${statusSelectHtml(o.id, o.status)}</td>
        <td>${formatDate(o.createdAt)}</td>
        <td><button class="admin-delete-order-btn" data-order-id="${escapeHtml(o.id)}">حذف سفارش</button></td>
      </tr>
    `).join('');
  }catch(e){
    loadingEl.style.display = 'none';
    emptyEl.textContent = e.message || 'خطا در بارگذاری سفارش‌ها';
    emptyEl.style.display = 'block';
  }
}

document.addEventListener('change', async e => {
  const select = e.target.closest('.status-select');
  if (!select) return;

  const orderId = select.dataset.orderId;
  const newStatus = select.value;
  select.disabled = true;

  try{
    const { res, data } = await adminApi(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(data.error || 'خطا در تغییر وضعیت سفارش');
    select.className = 'status-select ' + statusClass(newStatus);
  }catch(err){
    alert(err.message || 'تغییر وضعیت سفارش ناموفق بود.');
  }finally{
    select.disabled = false;
  }
});

// ---------------- Users ----------------
function userStatusHtml(isActive){
  const cls = isActive ? 'active' : 'inactive';
  const label = isActive ? 'فعال' : 'غیرفعال';
  return `<span class="user-status ${cls}"><span class="user-status-dot"></span>${label}</span>`;
}

let allUsers = [];

function renderUsersTable(users){
  const emptyEl = document.getElementById('users-admin-empty');
  const tableEl = document.getElementById('users-admin-table');
  const tbody = document.getElementById('users-admin-tbody');

  if (!users.length){
    tableEl.style.display = 'none';
    emptyEl.textContent = allUsers.length ? 'کاربری با این نام پیدا نشد.' : 'هنوز کاربری ثبت‌نام نکرده.';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  tableEl.style.display = '';

  tbody.innerHTML = users.map(u => `
      <tr data-phone="${escapeHtml(u.phone)}">
        <td>${escapeHtml(u.firstName)} ${escapeHtml(u.lastName)}</td>
        <td dir="ltr">${escapeHtml(u.phone)}</td>
        <td dir="ltr">${escapeHtml(u.email || '—')}</td>
        <td class="wrap">${escapeHtml(u.address || '—')}</td>
        <td>${userStatusHtml(u.isActive)}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td><button class="admin-delete-btn" data-phone="${escapeHtml(u.phone)}">حذف حساب</button></td>
      </tr>
    `).join('');
}

async function loadUsers(){
  const loadingEl = document.getElementById('users-admin-loading');
  const emptyEl = document.getElementById('users-admin-empty');
  const tableEl = document.getElementById('users-admin-table');
  const searchInput = document.getElementById('users-search-input');

  emptyEl.style.display = 'none';
  tableEl.style.display = 'none';
  loadingEl.style.display = 'flex';

  try{
    const [{ res, data }] = await Promise.all([ adminApi('/users', {}), wait(MIN_LOADING_MS) ]);
    loadingEl.style.display = 'none';

    if (!res.ok){
      if (res.status === 401) showLoggedOut();
      return;
    }
    allUsers = data.users || [];
    if (searchInput) searchInput.value = '';
    renderUsersTable(allUsers);
  }catch(e){
    loadingEl.style.display = 'none';
    emptyEl.textContent = e.message || 'خطا در بارگذاری کاربران';
    emptyEl.style.display = 'block';
  }
}

const usersSearchInput = document.getElementById('users-search-input');
if (usersSearchInput){
  usersSearchInput.addEventListener('input', () => {
    const q = usersSearchInput.value.trim();
    if (!q){
      renderUsersTable(allUsers);
      return;
    }
    const filtered = allUsers.filter(u => `${u.firstName} ${u.lastName}`.includes(q));
    renderUsersTable(filtered);
  });
}

document.addEventListener('click', async e => {
  const delOrderBtn = e.target.closest('.admin-delete-order-btn');
  if (!delOrderBtn) return;

  const orderId = delOrderBtn.dataset.orderId;
  const row = delOrderBtn.closest('tr');
  const label = row ? row.children[0].textContent.trim() : orderId;

  const confirmed = confirm(`سفارش «${label}» برای همیشه حذف بشه؟ این کار قابل بازگشت نیست.`);
  if (!confirmed) return;

  delOrderBtn.disabled = true;
  delOrderBtn.textContent = 'در حال حذف...';

  try{
    const { res, data } = await adminApi(`/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(data.error || 'خطا در حذف سفارش');
    loadOrders();
  }catch(err){
    alert(err.message || 'حذف سفارش ناموفق بود.');
    delOrderBtn.disabled = false;
    delOrderBtn.textContent = 'حذف سفارش';
  }
});

document.addEventListener('click', async e => {
  const delBtn = e.target.closest('.admin-delete-btn');
  if (!delBtn) return;

  const phone = delBtn.dataset.phone;
  const row = delBtn.closest('tr');
  const name = row ? row.children[0].textContent.trim() : phone;

  const confirmed = confirm(`حساب «${name}» (${phone}) برای همیشه حذف بشه؟ این کار قابل بازگشت نیست.`);
  if (!confirmed) return;

  delBtn.disabled = true;
  delBtn.textContent = 'در حال حذف...';

  try{
    const { res, data } = await adminApi(`/users/${encodeURIComponent(phone)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(data.error || 'خطا در حذف حساب');
    loadUsers();
  }catch(err){
    alert(err.message || 'حذف حساب ناموفق بود.');
    delBtn.disabled = false;
    delBtn.textContent = 'حذف حساب';
  }
});

// ---------------- Cache reset ----------------
const resetCacheBtn = document.getElementById('reset-cache-btn');
const cacheStatus = document.getElementById('cache-status');

if (resetCacheBtn){
  resetCacheBtn.addEventListener('click', async () => {
    resetCacheBtn.disabled = true;
    const original = resetCacheBtn.textContent;
    resetCacheBtn.textContent = 'در حال ریست...';
    cacheStatus.textContent = '';
    cacheStatus.className = 'cache-status';

    try{
      const { res, data } = await adminApi('/cache/reset', { method: 'POST' });
      if (!res.ok) throw new Error(data.error || 'خطا در ریست کش');
      cacheStatus.textContent = `کش سایت با موفقیت ریست شد (${formatDate(data.resetAt)})`;
    }catch(err){
      cacheStatus.textContent = err.message || 'ریست کش ناموفق بود.';
      cacheStatus.className = 'cache-status error';
    }finally{
      resetCacheBtn.disabled = false;
      resetCacheBtn.textContent = original;
    }
  });
}

const refreshOrdersBtn = document.getElementById('refresh-orders-btn');
if (refreshOrdersBtn) refreshOrdersBtn.addEventListener('click', loadOrders);

const refreshUsersBtn = document.getElementById('refresh-users-btn');
if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', loadUsers);

document.addEventListener('DOMContentLoaded', forceFreshLogin);
