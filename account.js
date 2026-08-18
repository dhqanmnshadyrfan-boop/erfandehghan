// Account page: login / register / profile / logout — talks to the real backend (server.js) via fetch.

const accountApp   = document.getElementById('account-app');
const authGate     = document.getElementById('auth-gate');

const accountForm      = document.getElementById('account-form');
const saveMsg          = document.getElementById('save-msg');
const accountName      = document.getElementById('account-name');
const accountPhoneLabel= document.querySelector('.account-phone');
const nameInput        = document.getElementById('account-name-input');
const phoneInput       = document.getElementById('account-phone-input');
const emailInput       = document.getElementById('account-email-input');
const addressInput     = document.getElementById('account-address-input');

const loginForm     = document.getElementById('login-form');
const loginPhone    = document.getElementById('login-phone');
const loginPassword = document.getElementById('login-password');
const loginError    = document.getElementById('login-error');

const registerForm     = document.getElementById('register-form');
const regFirst         = document.getElementById('reg-first');
const regLast          = document.getElementById('reg-last');
const regPhone         = document.getElementById('reg-phone');
const regPassword      = document.getElementById('reg-password');
const registerError    = document.getElementById('register-error');

const authTabs = document.querySelectorAll('.auth-tab');
const logoutLink = document.getElementById('logout-link');

const forgotLink          = document.getElementById('forgot-password-link');
const forgotPhoneForm     = document.getElementById('forgot-phone-form');
const forgotPhoneInput    = document.getElementById('forgot-phone');
const forgotPhoneError    = document.getElementById('forgot-phone-error');
const forgotCodeForm      = document.getElementById('forgot-code-form');
const forgotCodeHint      = document.getElementById('forgot-code-hint');
const forgotCodeInput     = document.getElementById('forgot-code');
const forgotNewPassword   = document.getElementById('forgot-new-password');
const forgotCodeError     = document.getElementById('forgot-code-error');
const resendCodeBtn       = document.getElementById('resend-code-btn');
const backToLogin1        = document.getElementById('back-to-login-1');
const backToLogin2        = document.getElementById('back-to-login-2');
const loginNotice         = document.getElementById('login-notice');
let resetPhone = '';

function containsDigit(str){
  return /[0-9۰-۹]/.test(str);
}

function isValidIranianMobile(str){
  const digits = faToEn(str || '').replace(/[^\d]/g, '');
  return /^09\d{9}$/.test(digits);
}

function normalizePhone(str){
  return faToEn(str || '').replace(/[^\d]/g, '');
}

function showMsg(text, isError){
  if (!saveMsg) return;
  saveMsg.textContent = text;
  saveMsg.className = 'save-msg ' + (isError ? 'error' : 'success');
}

function showFormError(el, text){
  if (!el) return;
  el.textContent = text;
}

// ---------------- Show logged-in vs logged-out state ----------------
async function renderAccountState(){
  const user = await apiGetCurrentUser();

  if (user){
    if (accountApp) accountApp.style.display = '';
    if (authGate) authGate.style.display = 'none';

    if (accountName) accountName.textContent = `${user.firstName} ${user.lastName}`.trim();
    if (accountPhoneLabel) accountPhoneLabel.textContent = user.phone;
    if (nameInput) nameInput.value = `${user.firstName} ${user.lastName}`.trim();
    if (phoneInput) phoneInput.value = user.phone;
    if (emailInput) emailInput.value = user.email || '';
    if (addressInput) addressInput.value = user.address || '';
  } else {
    if (accountApp) accountApp.style.display = 'none';
    if (authGate) authGate.style.display = '';
  }

  refreshAccountNavLabel();
}

// ---------------- Auth tabs (login / register) ----------------
function showAuthForm(which){
  [loginForm, registerForm, forgotPhoneForm, forgotCodeForm].forEach(f => { if (f) f.hidden = true; });
  if (which) which.hidden = false;
}

authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    showAuthForm(isLogin ? loginForm : registerForm);
    showFormError(loginError, '');
    showFormError(registerError, '');
    if (loginNotice) loginNotice.textContent = '';
  });
});

// ---------------- Login ----------------
if (loginForm){
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    showFormError(loginError, '');
    if (loginNotice) loginNotice.textContent = '';

    const phone = normalizePhone(loginPhone ? loginPhone.value : '');
    const password = loginPassword ? loginPassword.value : '';

    if (!isValidIranianMobile(phone)){
      showFormError(loginError, 'شماره موبایل معتبر نیست.');
      return;
    }
    if (!password){
      showFormError(loginError, 'رمز عبور را وارد کنید.');
      return;
    }

    try{
      await apiLogin(phone, password);
      await mergeGuestDataIntoAccount();
      loginForm.reset();
      await renderAccountState();
    }catch(err){
      showFormError(loginError, err.message || 'ورود ناموفق بود.');
    }
  });
}

// ---------------- Register ----------------
if (registerForm){
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    showFormError(registerError, '');

    const firstName = regFirst ? regFirst.value.trim() : '';
    const lastName  = regLast ? regLast.value.trim() : '';
    const phone     = normalizePhone(regPhone ? regPhone.value : '');
    const password  = regPassword ? regPassword.value : '';

    if (!firstName || containsDigit(firstName) || !lastName || containsDigit(lastName)){
      showFormError(registerError, 'لطفاً نام و نام خانوادگی معتبر وارد کنید.');
      return;
    }
    if (!isValidIranianMobile(phone)){
      showFormError(registerError, 'شماره موبایل معتبر نیست.');
      return;
    }
    if (!password || password.length < 6){
      showFormError(registerError, 'رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    try{
      await apiRegister({ firstName, lastName, phone, password });
      await mergeGuestDataIntoAccount();
      registerForm.reset();
      await renderAccountState();
    }catch(err){
      showFormError(registerError, err.message || 'ثبت‌نام ناموفق بود.');
    }
  });
}

// ---------------- Forgot password: step 1 — enter phone, request a code ----------------
async function sendResetCode(phone){
  showFormError(forgotCodeError, '');
  if (forgotCodeHint) forgotCodeHint.innerHTML = 'در حال ارسال کد...';

  try{
    const { devCode } = await apiForgotRequest(phone);
    // No real SMS gateway is connected yet — this spot is intentionally left for one
    // (e.g. Kavenegar, Melipayamak). Until it's wired up (and only outside production,
    // see server.js), the code is shown here directly so the flow can still be tested
    // end-to-end. In production this devCode is never sent by the server.
    if (forgotCodeHint){
      const phoneSafe = escapeHtml(phone);
      forgotCodeHint.innerHTML = devCode
        ? 'کد تایید برای شماره <b>' + phoneSafe + '</b> ارسال شد.<br>' +
          '<span class="demo-code-note">(سرویس پیامک هنوز وصل نشده — کد شما: <b>' + enToFa(devCode) + '</b>)</span>'
        : 'کد تایید برای شماره <b>' + phoneSafe + '</b> ارسال شد.';
    }
  }catch(err){
    if (forgotCodeHint) forgotCodeHint.textContent = '';
    showFormError(forgotCodeError, err.message || 'خطا در ارسال کد تایید.');
  }
}

if (forgotLink){
  forgotLink.addEventListener('click', () => {
    showAuthForm(forgotPhoneForm);
    showFormError(forgotPhoneError, '');
    if (forgotPhoneInput) forgotPhoneInput.value = loginPhone ? loginPhone.value : '';
  });
}

if (forgotPhoneForm){
  forgotPhoneForm.addEventListener('submit', async e => {
    e.preventDefault();
    showFormError(forgotPhoneError, '');

    const phone = normalizePhone(forgotPhoneInput ? forgotPhoneInput.value : '');
    if (!isValidIranianMobile(phone)){
      showFormError(forgotPhoneError, 'شماره موبایل معتبر نیست.');
      return;
    }

    resetPhone = phone;
    if (forgotCodeForm) forgotCodeForm.reset();
    showFormError(forgotCodeError, '');
    showAuthForm(forgotCodeForm);
    await sendResetCode(phone);
  });
}

// ---------------- Forgot password: step 2 — enter code + new password ----------------
if (resendCodeBtn){
  resendCodeBtn.addEventListener('click', async () => {
    if (!resetPhone) return;
    await sendResetCode(resetPhone);
  });
}

if (forgotCodeForm){
  forgotCodeForm.addEventListener('submit', async e => {
    e.preventDefault();
    showFormError(forgotCodeError, '');

    const code = forgotCodeInput ? normalizePhone(forgotCodeInput.value) : '';
    const newPassword = forgotNewPassword ? forgotNewPassword.value : '';

    if (!code){
      showFormError(forgotCodeError, 'کد تایید را وارد کنید.');
      return;
    }
    if (!newPassword || newPassword.length < 6){
      showFormError(forgotCodeError, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    try{
      await apiForgotVerify(resetPhone, code, newPassword);

      forgotCodeForm.reset();
      if (forgotPhoneForm) forgotPhoneForm.reset();

      authTabs.forEach(t => t.classList.remove('active'));
      const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
      if (loginTab) loginTab.classList.add('active');
      showAuthForm(loginForm);

      if (loginPhone) loginPhone.value = resetPhone;
      if (loginPassword) loginPassword.value = '';
      showFormError(loginError, '');
      if (loginNotice) loginNotice.textContent = 'رمز عبور با موفقیت تغییر کرد. اکنون با رمز جدید وارد شوید.';

      resetPhone = '';
    }catch(err){
      showFormError(forgotCodeError, err.message || 'کد وارد شده نادرست یا منقضی شده است.');
    }
  });
}

[backToLogin1, backToLogin2].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    authTabs.forEach(t => t.classList.remove('active'));
    const loginTab = document.querySelector('.auth-tab[data-tab="login"]');
    if (loginTab) loginTab.classList.add('active');
    showFormError(forgotPhoneError, '');
    showFormError(forgotCodeError, '');
    showAuthForm(loginForm);
  });
});

// ---------------- Profile save ----------------
if (accountForm){
  accountForm.addEventListener('submit', async e => {
    e.preventDefault();

    const fullName = nameInput ? nameInput.value.trim() : '';
    const phone = normalizePhone(phoneInput ? phoneInput.value : '');

    if (!fullName || containsDigit(fullName)){
      showMsg('نام وارد شده نامعتبر است؛ لطفاً به‌جای عدد، نام و نام خانوادگی خود را وارد کنید.', true);
      return;
    }
    if (!isValidIranianMobile(phone)){
      showMsg('شماره وارد شده نادرست است', true);
      return;
    }

    const parts = fullName.split(/\s+/);
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(' ');

    try{
      await apiUpdateProfile({
        firstName,
        lastName,
        phone,
        email: emailInput ? emailInput.value.trim() : '',
        address: addressInput ? addressInput.value.trim() : ''
      });
      await renderAccountState();
      showMsg('اطلاعات با موفقیت ثبت شد.', false);
      setTimeout(() => { if (saveMsg){ saveMsg.textContent = ''; saveMsg.className = 'save-msg'; } }, 3000);
    }catch(err){
      showMsg(err.message || 'خطا در ذخیره اطلاعات', true);
    }
  });
}

// ---------------- Logout ----------------
if (logoutLink){
  logoutLink.addEventListener('click', async e => {
    e.preventDefault();
    await apiLogout();
    await renderAccountState();
  });
}

document.addEventListener('DOMContentLoaded', renderAccountState);

// ---------------- Favorites (wishlist) list — server-backed when logged in ----------------
async function renderFavorites(){
  const listEl = document.getElementById('favorites-list');
  const emptyEl = document.getElementById('favorites-empty');
  if (!listEl) return;

  const items = (typeof getWishlist === 'function') ? await getWishlist() : [];

  if (!items.length){
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = items.map((item, idx) => `
    <li data-idx="${idx}">
      <div class="fav-thumb"><img src="${escapeHtml(item.image || 'images/phone.svg')}" alt="${escapeHtml(item.name)}"></div>
      <div class="fav-info">
        <b>${escapeHtml(item.name)}</b>
        <span>${enToFa(item.price)} <i>تومان</i></span>
      </div>
      <a class="btn btn-ghost fav-view" href="${escapeHtml(item.link || 'product.html')}">مشاهده</a>
      <button class="fav-remove" aria-label="حذف از علاقه‌مندی">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
      </button>
    </li>
  `).join('');
}

document.addEventListener('click', async e => {
  const removeBtn = e.target.closest('.fav-remove');
  if (!removeBtn) return;
  const li = removeBtn.closest('li');
  const idx = Number(li.dataset.idx);
  const list = await getWishlist();
  list.splice(idx, 1);
  await saveWishlist(list);
  renderFavorites();
});

document.addEventListener('DOMContentLoaded', renderFavorites);

// ---------------- Orders — real orders saved on the server ----------------
function orderStatusClass(status){
  if (status === 'تحویل شده') return 'done';
  if (status === 'در حال ارسال') return 'shipping';
  return 'pending';
}

async function renderOrders(){
  const listEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');
  if (!listEl) return;

  const orders = await apiGetMyOrders();

  if (!orders.length){
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = orders.map(order => `
    <li>
      <div>
        <b>سفارش #${order.id}</b>
        <span>${enToFa(order.items.length)} قلم کالا · ${enToFa(order.total)} تومان</span>
      </div>
      <span class="order-status ${orderStatusClass(order.status)}">${order.status}</span>
    </li>
  `).join('');
}

document.addEventListener('DOMContentLoaded', renderOrders);

// smooth scroll + active state for the simple in-page menu
document.querySelectorAll('.account-menu a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.account-menu a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
