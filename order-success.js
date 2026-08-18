// This page is meant to be the "callback URL" a real payment gateway
// redirects the browser back to after a successful payment. It reads the
// order that was stashed in sessionStorage before leaving for the gateway,
// and — only now, after payment — saves it to the server as a real order.

const PENDING_ORDER_KEY = 'mobilegsm_pending_order';

const loadingBox = document.getElementById('order-loading');
const doneBox    = document.getElementById('order-done');
const errorBox   = document.getElementById('order-error');
const emptyBox   = document.getElementById('order-empty');

function showOnly(box){
  [loadingBox, doneBox, errorBox, emptyBox].forEach(b => {
    if (b) b.style.display = (b === box) ? '' : 'none';
  });
}

async function finalizeOrder(){
  showOnly(loadingBox);

  const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
  if (!raw){
    showOnly(emptyBox);
    return;
  }

  let pending;
  try{
    pending = JSON.parse(raw);
  }catch(e){
    showOnly(emptyBox);
    return;
  }

  try{
    const order = await apiCreateOrder({
      items: pending.items,
      address: pending.address
    });

    // Order is confirmed on the server now — clear local state.
    sessionStorage.removeItem(PENDING_ORDER_KEY);
    await saveCart([]);
    await updateCartBadge();

    const idEl = document.getElementById('order-id-value');
    if (idEl) idEl.textContent = order.id;
    showOnly(doneBox);
  }catch(err){
    const msgEl = document.getElementById('order-error-message');
    if (msgEl) msgEl.textContent = err.message || 'خطایی در ثبت سفارش رخ داد.';
    showOnly(errorBox);
  }
}

const retryBtn = document.getElementById('order-retry-btn');
if (retryBtn){
  retryBtn.addEventListener('click', finalizeOrder);
}

document.addEventListener('DOMContentLoaded', finalizeOrder);
