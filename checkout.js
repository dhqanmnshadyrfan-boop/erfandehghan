// Collects delivery details (address, plaque, unit, postal code) before
// handing the user off to the payment gateway. Runs after the cart page —
// the actual order is only saved to the server on order-success.html, once
// a real gateway integration confirms payment succeeded.

const PENDING_ORDER_KEY = 'mobilegsm_pending_order';

const formWrap   = document.getElementById('checkout-form-wrap');
const emptyBox   = document.getElementById('checkout-empty');
const summaryEl  = document.getElementById('checkout-summary');
const form       = document.getElementById('shipping-form');
const addressEl  = document.getElementById('ship-address-input');
const plaqueEl   = document.getElementById('ship-plaque-input');
const unitEl     = document.getElementById('ship-unit-input');
const postalEl   = document.getElementById('ship-postal-input');
const errorEl    = document.getElementById('shipping-error');
const submitBtn  = document.getElementById('shipping-submit-btn');

async function initCheckout(){
  const cart = await getCart();

  if (!cart.length){
    if (emptyBox) emptyBox.style.display = 'block';
    return;
  }

  const user = await apiGetCurrentUser();
  if (!user){
    alert('برای تکمیل خرید ابتدا وارد حساب کاربری خود شوید.');
    window.location.href = 'account.html';
    return;
  }

  if (formWrap) formWrap.style.display = 'flex';

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (summaryEl){
    summaryEl.textContent = `${enToFa(totalQty)} کالا در سبد شما · مبلغ قابل پرداخت: ${enToFa(total)} تومان`;
  }

  if (user.address && addressEl) addressEl.value = user.address;
}

if (form){
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.textContent = '';

    const address = (addressEl.value || '').trim();
    const plaque  = faToEn((plaqueEl.value || '').trim()).replace(/[^\d]/g, '');
    const unit    = faToEn((unitEl.value || '').trim()).replace(/[^\d]/g, '');
    const postal  = faToEn((postalEl.value || '').trim()).replace(/[^\d]/g, '');

    if (!plaque){
      errorEl.textContent = 'لطفاً پلاک را وارد کنید.';
      plaqueEl.focus();
      return;
    }
    if (!unit){
      errorEl.textContent = 'لطفاً واحد را وارد کنید.';
      unitEl.focus();
      return;
    }
    if (postal.length !== 10){
      errorEl.textContent = 'کد پستی باید دقیقاً ۱۰ رقم باشد.';
      postalEl.focus();
      return;
    }

    const cart = await getCart();
    if (!cart.length){
      errorEl.textContent = 'سبد خرید شما خالی است.';
      return;
    }
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const fullAddress = `${address} - پلاک ${plaque} - واحد ${unit} - کدپستی ${postal}`;

    // Stash the order so order-success.html can save it to the server
    // once the payment gateway sends the user back to the site.
    sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
      items: cart,
      address: fullAddress,
      total
    }));

    if (submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = 'در حال انتقال به درگاه پرداخت...';
    }

    // ================================================================
    // 🔌 REAL PAYMENT GATEWAY GOES HERE.
    // When you connect a real gateway (Zarinpal, IDPay, etc.), replace
    // the redirect below with a redirect to the gateway's payment page,
    // passing the amount and a callback URL of:
    //     https://yourdomain.com/order-success.html
    // The gateway sends the browser back to that URL only after a
    // successful payment; order-success.html reads the pending order
    // above and saves it to the server as a real, confirmed order.
    // ================================================================
    window.location.href = 'order-success.html';
  });
}

document.addEventListener('DOMContentLoaded', initCheckout);
