// ---------------- Dynamic product rendering ----------------
// Reads ?id=<product-id> from the URL and fills the page with that
// product's data from products-data.js. Falls back to s24ultra if the
// id is missing or unknown, so old links to product.html keep working.
const urlParams = new URLSearchParams(window.location.search);
const PRODUCT_ID = (typeof PRODUCT_CATALOG !== 'undefined' && PRODUCT_CATALOG[urlParams.get('id')])
  ? urlParams.get('id')
  : 's24ultra';

function faDigitsProduct(str){
  const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
  return String(str).replace(/[0-9]/g, d => map[d]);
}
function formatToman(n){
  return faDigitsProduct(n.toLocaleString('en-US')).replace(/,/g, '٬');
}

function renderProduct(){
  if (typeof PRODUCT_CATALOG === 'undefined') return;
  const p = PRODUCT_CATALOG[PRODUCT_ID];
  if (!p) return;

  const categoryLabel = (typeof CATEGORY_LABELS !== 'undefined' && CATEGORY_LABELS[p.category]) || 'محصولات';
  const brandPrefix = p.brand ? p.brand + ' · ' : 'Mobile GSM · ';

  document.title = p.name + ' | Mobile GSM';
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = p.name + ' | Mobile GSM';

  const breadcrumbCat = document.getElementById('breadcrumb-cat');
  if (breadcrumbCat) breadcrumbCat.textContent = categoryLabel;
  const breadcrumbName = document.getElementById('breadcrumb-name');
  if (breadcrumbName) breadcrumbName.textContent = p.name;

  // Gallery
  const galleryMain = document.getElementById('gallery-main');
  const galleryBadge = document.getElementById('gallery-badge');
  const galleryImage = document.getElementById('gallery-image');
  const discountPercent = p.oldPrice ? Math.round((p.oldPrice - p.price) / p.oldPrice * 100) : 0;
  if (galleryMain) {
    galleryMain.classList.remove('t-teal', 't-amber', 't-violet');
    galleryMain.classList.add(p.thumbClass || 't-teal');
  }
  if (galleryBadge) galleryBadge.style.display = discountPercent ? '' : 'none';
  if (galleryBadge && discountPercent) galleryBadge.textContent = faDigitsProduct(discountPercent) + '٪-';
  if (galleryImage) { galleryImage.src = p.image; galleryImage.alt = p.name; }

  // Default thumbnail strip, shared by category — used only when a product
  // doesn't define its own `thumbs` array in products-data.js.
  const defaultThumbSets = {
    phone: [ [p.image, 'نمای جلو'], ['images/case.svg', 'قاب و کاور'], ['images/charger.svg', 'آداپتور همراه'], ['images/cable.svg', 'کابل شارژ همراه'] ],
    speaker: [ [p.image, 'نمای محصول'], ['images/charger.svg', 'آداپتور شارژ'], ['images/cable.svg', 'کابل شارژ همراه'] ],
    modem: [ [p.image, 'نمای محصول'], ['images/cable.svg', 'کابل شارژ همراه'], ['images/charger.svg', 'آداپتور برق'] ],
    accessory: [ [p.image, 'نمای محصول'], ['images/cable.svg', 'کابل شارژ همراه'], ['images/charger.svg', 'آداپتور شارژ'] ]
  };
  // p.thumbs (set per-product in products-data.js) takes priority when present,
  // so each product can have its own custom thumbnail images.
  const thumbs = p.thumbs || defaultThumbSets[p.category] || defaultThumbSets.accessory;
  const galleryThumbs = document.getElementById('gallery-thumbs');
  if (galleryThumbs) {
    galleryThumbs.innerHTML = thumbs.map((t, i) =>
      `<button class="thumb${i === 0 ? ' active' : ''}" data-img="${t[0]}" aria-label="${t[1]}"><img src="${t[0]}" alt="${t[1]}"></button>`
    ).join('');
  }

  const eyebrow = document.getElementById('p-eyebrow');
  if (eyebrow) eyebrow.textContent = brandPrefix + p.name;
  const title = document.getElementById('p-title');
  if (title) title.textContent = p.name;

  // Note: the star rating + review count shown next to the gallery image are
  // NOT set here from static product data — they're computed from the real,
  // stored reviews for this product by recalcSummary() below, and update
  // live whenever a review is loaded or submitted.
  const soldCount = document.getElementById('p-sold-count');
  if (soldCount) { soldCount.textContent = p.soldText ? '· ' + p.soldText : ''; soldCount.style.display = p.soldText ? '' : 'none'; }

  const oldPriceEl = document.getElementById('p-old-price');
  const priceEl = document.getElementById('p-price');
  const offTag = document.getElementById('p-off-tag');
  if (oldPriceEl) { oldPriceEl.style.display = p.oldPrice ? '' : 'none'; oldPriceEl.textContent = p.oldPrice ? formatToman(p.oldPrice) + ' تومان' : ''; }
  if (priceEl) priceEl.innerHTML = formatToman(p.price) + ' <i>تومان</i>';
  if (offTag) { offTag.style.display = discountPercent ? '' : 'none'; offTag.textContent = discountPercent ? faDigitsProduct(discountPercent) + '٪ تخفیف' : ''; }

  // ---------------- Sticky buy bar (mirrors the main price box, visible
  // on every screen size — see product.css / product.html) ----------------
  const stickyThumb = document.getElementById('sticky-buy-thumb');
  if (stickyThumb) { stickyThumb.src = p.image; stickyThumb.alt = p.name; }

  const stickyThumbOff = document.getElementById('sticky-buy-thumb-off');
  if (stickyThumbOff) {
    stickyThumbOff.style.display = discountPercent ? '' : 'none';
    stickyThumbOff.textContent = discountPercent ? '-' + faDigitsProduct(discountPercent) + '٪' : '';
  }

  const stickyName = document.getElementById('sticky-buy-name');
  if (stickyName) stickyName.textContent = p.name;

  const stickyOldPrice = document.getElementById('sticky-buy-old-price');
  if (stickyOldPrice) { stickyOldPrice.style.display = p.oldPrice ? '' : 'none'; stickyOldPrice.textContent = p.oldPrice ? formatToman(p.oldPrice) + ' تومان' : ''; }

  const priceStickyEl = document.getElementById('p-price-sticky');
  if (priceStickyEl) priceStickyEl.innerHTML = formatToman(p.price) + ' <i>تومان</i>';

  const stickyOff = document.getElementById('sticky-buy-off');
  if (stickyOff) {
    stickyOff.style.display = discountPercent ? '' : 'none';
    stickyOff.textContent = discountPercent ? faDigitsProduct(discountPercent) + '٪ تخفیف' : '';
  }

  const shortDesc = document.getElementById('p-short-desc');
  if (shortDesc) shortDesc.textContent = p.name + (p.specLine ? ' با ' + p.specLine + '.' : '.') + ' نو، آکبند و اصل با گارانتی معتبر فروشگاه.';

  // Color / storage options: only shown for phones
  const optionsWrap = document.getElementById('p-options');
  if (optionsWrap) {
    const isPhone = p.category === 'phone';
    optionsWrap.style.display = isPhone ? '' : 'none';
    if (isPhone) {
      const optColors = document.getElementById('opt-colors');
      const optStorages = document.getElementById('opt-storages');
      if (optColors && p.colors) {
        optColors.innerHTML = p.colors.map((c, i) => `<button class="opt-chip${i === 0 ? ' active' : ''}">${c}</button>`).join('');
      }
      if (optStorages && p.storages) {
        optStorages.innerHTML = p.storages.map((s, i) => `<button class="opt-chip${i === 0 ? ' active' : ''}">${s}</button>`).join('');
      }
    }
  }

  const descText = document.getElementById('desc-text');
  if (descText) descText.textContent = p.longDesc || (p.name + ' با کیفیت ساخت مناسب و عملکرد قابل اعتماد، گزینه‌ای مطمئن برای استفاده روزمره است.' + (p.specLine ? ' از ویژگی‌های آن می‌توان به ' + p.specLine + ' اشاره کرد.' : '') + ' این محصول به‌صورت اصل و با گارانتی فروشگاه Mobile GSM عرضه می‌شود.');

  const featureList = document.getElementById('feature-list');
  if (featureList) {
    const checkSvg = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l2.5 2.5L16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> ';
    const feats = p.features || (p.specLine ? p.specLine.split('·').map(s => s.trim()).filter(Boolean) : []);
    feats.push('گارانتی معتبر فروشگاه Mobile GSM');
    featureList.innerHTML = feats.map(f => `<li>${checkSvg}${f}</li>`).join('');
  }

  const specTable = document.getElementById('spec-table');
  if (specTable) {
    const rows = p.specs || [
      ['برند', p.brand || 'Mobile GSM'],
      ['مدل', p.name],
      ['دسته‌بندی', categoryLabel],
      ['ویژگی‌های کلیدی', p.specLine || '—'],
      ['گارانتی', faDigitsProduct(p.warrantyMonths || (p.category === 'phone' ? 18 : 12)) + ' ماه گارانتی فروشگاه'],
      ['کد فنی', 'MGX-' + PRODUCT_ID.toUpperCase()]
    ];
    specTable.innerHTML = rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('');
  }
}

renderProduct();

// ---------------- Sticky buy bar visibility ----------------
// The floating bottom bar is only useful while the real "افزودن به سبد
// خرید" row AND the footer are both off-screen — it would be a redundant
// duplicate once #buy-row is visible again (scrolling up), and it must
// get out of the way once the footer arrives (scrolling down) so it
// never covers the footer and the footer can sit flush at the true
// bottom of the page exactly like on every other page (no reserved
// empty space needed below it).
//
// Both #buy-row and .site-footer are watched with one IntersectionObserver;
// the bar shows only when *neither* is currently in view. The footer's
// rootMargin is expanded upward by roughly the bar's own height, so the
// bar finishes sliding away *before* the footer visually reaches the
// screen — never a frame of overlap.
(function initStickyBuyBarVisibility(){
  const stickyBar = document.getElementById('sticky-buy-bar');
  const buyRow = document.getElementById('buy-row');
  const footer = document.querySelector('.site-footer');
  if (!stickyBar || !buyRow) return;

  function syncBarHeight(){
    document.documentElement.style.setProperty('--sticky-buy-bar-h', stickyBar.offsetHeight + 'px');
  }
  syncBarHeight();
  window.addEventListener('resize', syncBarHeight);
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncBarHeight).observe(stickyBar);
  }

  if (!('IntersectionObserver' in window)) {
    // No IntersectionObserver support: fall back to always showing the bar,
    // and reserve static clearance space (see product.css) so it can never
    // cover the footer permanently.
    stickyBar.classList.remove('is-hidden');
    document.body.classList.add('sticky-bar-static-fallback');
    return;
  }

  const state = { buyRowVisible: true, footerVisible: false };
  function applyVisibility(){
    stickyBar.classList.toggle('is-hidden', state.buyRowVisible || state.footerVisible);
  }

  const buyRowObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { state.buyRowVisible = entry.isIntersecting; });
    applyVisibility();
  }, { threshold: 0, rootMargin: '0px' });
  buyRowObserver.observe(buyRow);

  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => { state.footerVisible = entry.isIntersecting; });
      applyVisibility();
    }, {
      threshold: 0,
      // Expand the viewport's bottom edge upward by the bar's height (with
      // a little extra buffer) so the footer counts as "arriving" — and the
      // bar starts sliding away — before it's actually on screen yet.
      rootMargin: `0px 0px ${Math.max(140, stickyBar.offsetHeight + 30)}px 0px`
    });
    footerObserver.observe(footer);
  }
})();

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// Gallery thumbnails
const galleryImage = document.getElementById('gallery-image');
document.querySelectorAll('.thumb').forEach(thumb => {
  thumb.addEventListener('click', () => {
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    if (galleryImage && thumb.dataset.img) {
      galleryImage.style.opacity = 0;
      setTimeout(() => {
        galleryImage.setAttribute('src', thumb.dataset.img);
        galleryImage.style.opacity = 1;
      }, 120);
    }
  });
});

// ---------------- Image lightbox (click main image to view full-size, like Digikala) ----------------
const galleryMainEl = document.getElementById('gallery-main');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let lightboxImages = [];
let lightboxIndex = 0;

function getGalleryImages(){
  const thumbEls = Array.from(document.querySelectorAll('.thumb'));
  if (thumbEls.length) {
    return thumbEls.map(t => ({ src: t.dataset.img, alt: t.getAttribute('aria-label') || '' }));
  }
  // No thumbnail strip rendered — fall back to whatever the main image currently shows.
  return galleryImage ? [{ src: galleryImage.getAttribute('src'), alt: galleryImage.getAttribute('alt') || '' }] : [];
}

function updateLightboxNav(){
  const onlyOne = lightboxImages.length <= 1;
  if (lightboxPrev) lightboxPrev.classList.toggle('hidden', onlyOne);
  if (lightboxNext) lightboxNext.classList.toggle('hidden', onlyOne);
}

function showLightboxImage(index){
  if (!lightboxImages.length) return;
  lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
  const img = lightboxImages[lightboxIndex];
  if (lightboxImage) { lightboxImage.src = img.src; lightboxImage.alt = img.alt; }

  // Keep the underlying gallery + active thumbnail in sync with the lightbox.
  const thumbEls = Array.from(document.querySelectorAll('.thumb'));
  if (thumbEls[lightboxIndex]) {
    thumbEls.forEach(t => t.classList.remove('active'));
    thumbEls[lightboxIndex].classList.add('active');
  }
  if (galleryImage) galleryImage.setAttribute('src', img.src);
}

function openLightbox(startIndex){
  lightboxImages = getGalleryImages();
  if (!lightboxImages.length || !lightbox) return;
  updateLightboxNav();
  showLightboxImage(startIndex || 0);
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(){
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

if (galleryMainEl) {
  galleryMainEl.addEventListener('click', () => {
    const thumbEls = Array.from(document.querySelectorAll('.thumb'));
    const activeIndex = Math.max(0, thumbEls.findIndex(t => t.classList.contains('active')));
    openLightbox(activeIndex);
  });
}
if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxPrev) lightboxPrev.addEventListener('click', e => { e.stopPropagation(); showLightboxImage(lightboxIndex - 1); });
if (lightboxNext) lightboxNext.addEventListener('click', e => { e.stopPropagation(); showLightboxImage(lightboxIndex + 1); });
if (lightbox) {
  lightbox.addEventListener('click', e => {
    // Clicking the dark backdrop (not the image itself) closes the lightbox.
    if (e.target === lightbox) closeLightbox();
  });
}
document.addEventListener('keydown', e => {
  if (!lightbox || !lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex + 1); // RTL: left = next
  else if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex - 1); // RTL: right = prev
});

// Option chips (color / quality)
document.querySelectorAll('.option-row').forEach(row => {
  row.querySelectorAll('.opt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      row.querySelectorAll('.opt-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

// Quantity stepper
const qtyInput = document.querySelector('.qty-box input');
const toFa = n => n.toLocaleString('fa-IR');
let qty = 1;
document.querySelectorAll('.qty-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    qty = i === 0 ? Math.max(1, qty - 1) : qty + 1;
    if (qtyInput) qtyInput.value = toFa(qty);
  });
});
window.resetProductQty = function(){
  qty = 1;
  if (qtyInput) qtyInput.value = toFa(qty);
};

// ---------------- Reviews: star input + submit + persistence (shared server-side, all visitors see the same reviews) ----------------
const REVIEW_PRODUCT_ID = PRODUCT_ID;
const starInput = document.getElementById('star-input');
const reviewForm = document.getElementById('review-form');
const reviewList = document.getElementById('review-list');
const reviewMsg = document.getElementById('review-msg');
let selectedStars = 0;

function paintStars(n){
  if (!starInput) return;
  starInput.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.star) <= n);
  });
}

if (starInput) {
  starInput.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStars = Number(btn.dataset.star);
      paintStars(selectedStars);
      const hint = starInput.querySelector('.star-hint');
      if (hint) hint.textContent = selectedStars + ' از ۵ ستاره';
    });
  });
}

function starsToText(n){ return '★'.repeat(n) + '☆'.repeat(5 - n); }

function buildReviewItem(name, text, rating){
  const li = document.createElement('li');
  li.className = 'review-item';
  li.dataset.rating = rating;
  li.innerHTML =
    '<div class="review-head"><b></b><span class="p-rate"></span></div><p></p>';
  li.querySelector('b').textContent = name;
  li.querySelector('.p-rate').textContent = starsToText(rating);
  li.querySelector('p').textContent = text;
  return li;
}

function toFaDigits(str){
  const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
  return String(str).replace(/[0-9]/g, d => map[d]);
}

function starsString(n){
  const rounded = Math.max(0, Math.min(5, Math.round(n)));
  return '★★★★★☆☆☆☆☆'.slice(5 - rounded, 10 - rounded);
}

function recalcSummary(){
  if (!reviewList) return;
  const items = reviewList.querySelectorAll('.review-item');
  const total = items.length;
  let sum = 0;
  items.forEach(it => sum += Number(it.dataset.rating || 0));
  const avg = total ? (sum / total) : 0;
  const avgText = toFaDigits(avg.toFixed(1));
  const totalText = toFa(total);

  // Reviews-tab summary
  const avgEl = document.getElementById('review-avg');
  const avgStarsEl = document.getElementById('review-avg-stars');
  const totalEl = document.getElementById('review-total');
  const countEl = document.getElementById('review-count');
  if (avgEl) avgEl.textContent = avgText;
  if (avgStarsEl) avgStarsEl.textContent = starsString(avg);
  if (totalEl) totalEl.textContent = totalText;
  if (countEl) countEl.textContent = totalText;

  // Rating badge next to the gallery image — always the real count, and it
  // grows by one the moment a new review is submitted (see reviewForm below).
  const rateStars = document.getElementById('p-rate-stars');
  const rateCount = document.getElementById('p-rate-count');
  if (rateStars) rateStars.textContent = starsString(avg);
  if (rateCount) rateCount.textContent = avgText + ' از ۵ (' + totalText + ' نظر)';
}

async function loadStoredReviews(){
  if (!reviewList) return;
  const stored = await apiGetReviews(REVIEW_PRODUCT_ID);
  stored.slice().reverse().forEach(r => reviewList.prepend(buildReviewItem(r.name, r.text, r.rating)));
  recalcSummary();
}

if (reviewForm) {
  reviewForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('review-name');
    const textInput = document.getElementById('review-text');
    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!selectedStars) {
      if (reviewMsg) { reviewMsg.textContent = 'لطفاً امتیاز خود را انتخاب کنید.'; reviewMsg.className = 'review-msg error'; }
      return;
    }
    if (!name || !text) return;

    try{
      await apiAddReview(REVIEW_PRODUCT_ID, { name, text, rating: selectedStars });

      const item = buildReviewItem(name, text, selectedStars);
      reviewList.prepend(item);
      recalcSummary();

      reviewForm.reset();
      selectedStars = 0;
      paintStars(0);
      const hint = starInput ? starInput.querySelector('.star-hint') : null;
      if (hint) hint.textContent = 'امتیاز خود را انتخاب کنید';
      if (reviewMsg) { reviewMsg.textContent = 'نظر شما با موفقیت ثبت شد. ممنون از همراهی شما!'; reviewMsg.className = 'review-msg success'; }
    }catch(err){
      if (reviewMsg) { reviewMsg.textContent = err.message || 'خطا در ثبت نظر'; reviewMsg.className = 'review-msg error'; }
    }
  });
}

document.addEventListener('DOMContentLoaded', loadStoredReviews);

