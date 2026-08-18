// Renders the cart (server-backed when logged in, localStorage for guests), handles qty change / remove / checkout.

async function renderCart(){
  const cart = await getCart();
  const emptyEl = document.getElementById('cart-empty');
  const filledEl = document.getElementById('cart-filled');
  const linesEl = document.getElementById('cart-lines');
  const countLabel = document.getElementById('cart-count-label');

  if(!cart.length){
    emptyEl.style.display = 'flex';
    filledEl.style.display = 'none';
    if (countLabel) countLabel.textContent = '';
    return;
  }

  emptyEl.style.display = 'none';
  filledEl.style.display = 'grid';

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  if (countLabel) countLabel.textContent = enToFa(totalQty) + ' کالا در سبد شما';

  linesEl.innerHTML = cart.map((item, idx) => `
    <div class="cart-line" data-idx="${idx}">
      <div class="p-thumb ${escapeHtml(item.colorClass || 't-teal')}"><img src="${escapeHtml(item.image || 'images/phone.svg')}" alt="${escapeHtml(item.name)}"></div>
      <div class="cart-line-info">
        <h4>${escapeHtml(item.name)}</h4>
        <span>${enToFa(item.price)} <i>تومان</i></span>
      </div>
      <div class="qty-box">
        <button class="qty-btn minus" aria-label="کم کردن">−</button>
        <input type="text" readonly value="${enToFa(item.qty)}">
        <button class="qty-btn plus" aria-label="زیاد کردن">+</button>
      </div>
      <div class="line-total">${enToFa(item.price * item.qty)} تومان</div>
      <button class="remove-btn" aria-label="حذف از سبد">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>
        </svg>
      </button>
    </div>
  `).join('');

  updateSummary(cart);
}

function updateSummary(cart){
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const subtotalEl = document.getElementById('sum-subtotal');
  const totalEl = document.getElementById('sum-total');
  if (subtotalEl) subtotalEl.textContent = enToFa(subtotal) + ' تومان';
  if (totalEl) totalEl.textContent = enToFa(subtotal) + ' تومان';
}

document.addEventListener('click', async e => {
  const line = e.target.closest('.cart-line');
  if (!line) return;
  const idx = Number(line.dataset.idx);
  const cart = await getCart();
  if (!cart[idx]) return;

  if (e.target.closest('.minus')){
    cart[idx].qty = Math.max(1, cart[idx].qty - 1);
    await saveCart(cart);
    renderCart();
  }
  if (e.target.closest('.plus')){
    cart[idx].qty += 1;
    await saveCart(cart);
    renderCart();
  }
  if (e.target.closest('.remove-btn')){
    cart.splice(idx, 1);
    await saveCart(cart);
    renderCart();
  }
});

const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn){
  checkoutBtn.addEventListener('click', async () => {
    const cart = await getCart();
    if (!cart.length) return;

    const user = await apiGetCurrentUser();
    if (!user){
      alert('برای تکمیل خرید ابتدا وارد حساب کاربری خود شوید.');
      window.location.href = 'account.html';
      return;
    }

    // Shipping details (address, plaque, unit, postal code) are collected
    // on the next page, right before handing off to the payment gateway.
    window.location.href = 'checkout.html';
  });
}

document.addEventListener('DOMContentLoaded', renderCart);
