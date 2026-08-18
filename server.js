// MobileGSM backend — zero external dependencies (pure Node.js, plain JSON file storage).
// Run with:  node server.js
// Then open: http://localhost:3000
//
// Requires no special Node.js version — no experimental modules are used.

const http = require('node:http');
const db = require('./server/db');
const { hashPassword, verifyPassword, createToken, parseCookies, publicUser } = require('./server/auth');
const serveStatic = require('./server/static');
const { clearStaticCache } = require('./server/static');
const { getClientIp, isRateLimited, recordAttempt, clearAttempts, isSafeObjectKey, randomId } = require('./server/security');
const { PRODUCT_CATALOG } = require('./products-data');

const PORT = process.env.PORT || 3000;
// SECURE BY DEFAULT: unless someone explicitly opts into local/dev testing
// (NODE_ENV=development), the server always behaves as if it's in
// production — the password-reset code is never echoed back in API
// responses, and session cookies get the Secure flag. This way nothing
// needs to be configured on the host at all; the safe behavior is what
// you get automatically. To see the reset code locally while testing the
// forgot-password flow (no real SMS gateway is wired up yet), run with
// NODE_ENV=development explicitly, e.g.:  NODE_ENV=development node server.js
const IS_DEV_MODE = process.env.NODE_ENV === 'development';
const IS_PRODUCTION = !IS_DEV_MODE;
if (IS_DEV_MODE) {
  console.warn('⚠️  Running in development mode (NODE_ENV=development) — the password-reset code is being echoed back in API responses for local testing. Never run with NODE_ENV=development on a real/public deployment.');
}

// Build a { productName -> canonicalPrice } lookup once at startup so order
// totals are always priced from the server's own catalog, never trusted
// from the client. See /api/orders below.
const PRICE_BY_NAME = new Map(
  Object.values(PRODUCT_CATALOG || {}).map(p => [p.name, p.price])
);

const MAX_JSON_BODY_BYTES = 1e6; // 1MB safety limit

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > MAX_JSON_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Security headers applied to every response (JSON + static). These don't
// require any external package — just plain HTTP headers.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  // Static assets are same-origin only and the app has no inline-script
  // reliance beyond what's already in the HTML files, so a fairly strict
  // default-src is safe here. Adjust if a payment gateway/CDN is added.
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
};

function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
}

function sendJson(res, status, obj) {
  applySecurityHeaders(res);
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function isValidIranianMobile(phone) {
  return /^09\d{9}$/.test(phone);
}

// Very small CSRF defense-in-depth check for state-changing requests. The
// session cookie is already SameSite=Lax (browsers won't attach it to a
// cross-site POST/PUT/PATCH/DELETE at all), but we also confirm the
// request's own Origin header — when the browser sends one — matches this
// server's Host, so a request from another origin is rejected outright.
function hasValidOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // many same-origin requests, and all non-browser tools, omit Origin
  try {
    const originHost = new URL(origin).host;
    return originHost === req.headers.host;
  } catch (e) {
    return false;
  }
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies['session_token'];
  if (!token) return null;
  const sessions = db.getSessions();
  const session = sessions[token];
  if (!session) return null;
  const users = db.getUsers();
  const user = users[session.phone] || null;
  if (user) {
    // Refresh the session's last-seen time so "active" status reflects
    // real, recent activity instead of just "logged in at some point".
    session.lastSeenAt = new Date().toISOString();
    db.saveSessions(sessions);
  }
  return user;
}

// A user only counts as "active" (فعال) if one of their sessions has been
// used within this window. Without this, a session created once and never
// explicitly logged out would show the account as active forever.
const ACTIVE_SESSION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getActivePhones() {
  const sessions = db.getSessions();
  const now = Date.now();
  const activePhones = new Set();
  Object.values(sessions).forEach(session => {
    const lastSeen = new Date(session.lastSeenAt || session.createdAt).getTime();
    if (now - lastSeen <= ACTIVE_SESSION_WINDOW_MS) {
      activePhones.add(session.phone);
    }
  });
  return activePhones;
}

function setSessionCookie(res, token) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  // `Secure` (cookie only sent over HTTPS) is added automatically once
  // NODE_ENV=production is set — see the deployment notes. It's left off
  // in local/dev mode because plain http://localhost has no TLS, and a
  // Secure cookie there would just get silently dropped by the browser.
  const secure = IS_PRODUCTION ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`);
}

function clearSessionCookie(res) {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

function createSessionFor(res, phone) {
  const token = createToken();
  const sessions = db.getSessions();
  sessions[token] = { phone, createdAt: new Date().toISOString() };
  db.saveSessions(sessions);
  setSessionCookie(res, token);
}

// ---------------- Admin (separate from regular user accounts) ----------------
// The password below is never stored in plaintext — only its scrypt hash + salt
// are kept, exactly like regular user passwords. To change the admin password,
// run: node -e "console.log(require('./server/auth').hashPassword('NEW_PASSWORD'))"
// and replace the two constants below with the printed hash/salt.
const ADMIN_USERNAME = 'Erfandd';
const ADMIN_PASSWORD_HASH = 'dbfaf9af4ba6045c85a9b505a40a6aec1ab426ce6e5d74fca5ce2c558a6f18347032dcb2a375809976325105da45bb21aacb4a3a857607de61416cc75d1c7d47';
const ADMIN_PASSWORD_SALT = '6cba49fe458dccb407f00fddbb7960e6';

function isAdminAuthed(req) {
  const cookies = parseCookies(req);
  const token = cookies['admin_session'];
  if (!token) return false;
  const sessions = db.getAdminSessions();
  return !!sessions[token];
}

function setAdminSessionCookie(res, token) {
  // No Max-Age: this is a session cookie — it does not persist once the
  // browser is fully closed, and the admin panel also forces a fresh
  // login on every page load regardless (see admin.js forceFreshLogin).
  const secure = IS_PRODUCTION ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Path=/; SameSite=Lax${secure}`);
}

function clearAdminSessionCookie(res) {
  const secure = IS_PRODUCTION ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const url = parsedUrl.pathname;
  const query = parsedUrl.searchParams;

  // Reject any state-changing request whose Origin header doesn't match
  // this server, as a defense-in-depth CSRF guard (see hasValidOrigin above).
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !hasValidOrigin(req)) {
    return sendJson(res, 403, { error: 'درخواست نامعتبر (Origin نامعتبر).' });
  }

  const clientIp = getClientIp(req);

  try {
    // ---------------- Register ----------------
    if (req.method === 'POST' && url === '/api/auth/register') {
      // Throttle registrations per-IP so this can't be used to mass-create
      // accounts or hammer the scrypt hashing function.
      if (isRateLimited('register:' + clientIp, { max: 10, windowMs: 15 * 60 * 1000 })) {
        return sendJson(res, 429, { error: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' });
      }
      recordAttempt('register:' + clientIp, 15 * 60 * 1000);

      const body = await readJsonBody(req);
      const firstName = (body.firstName || '').trim().slice(0, 60);
      const lastName  = (body.lastName || '').trim().slice(0, 60);
      const phone     = (body.phone || '').trim();
      const password  = body.password || '';

      if (!firstName || !lastName) {
        return sendJson(res, 400, { error: 'نام و نام خانوادگی الزامی است.' });
      }
      if (!isValidIranianMobile(phone)) {
        return sendJson(res, 400, { error: 'شماره موبایل معتبر نیست.' });
      }
      if (!password || password.length < 6) {
        return sendJson(res, 400, { error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
      }

      const users = db.getUsers();
      if (users[phone]) {
        return sendJson(res, 409, { error: 'این شماره قبلاً ثبت‌نام کرده است؛ از تب «ورود» وارد شوید.' });
      }

      const { hash, salt } = hashPassword(password);
      const user = {
        phone, firstName, lastName,
        email: '', address: '',
        passwordHash: hash, passwordSalt: salt,
        createdAt: new Date().toISOString()
      };
      users[phone] = user;
      db.saveUsers(users);

      createSessionFor(res, phone);
      return sendJson(res, 201, { user: publicUser(user) });
    }

    // ---------------- Login ----------------
    if (req.method === 'POST' && url === '/api/auth/login') {
      const body = await readJsonBody(req);
      const phone = (body.phone || '').trim();
      const password = body.password || '';

      // Lock out repeated failed attempts per phone+IP pair — slows down
      // both password-guessing against one account and credential stuffing
      // from one machine, without letting one attacker lock out a victim's
      // account from a different IP.
      const loginKey = `login:${phone}:${clientIp}`;
      if (isRateLimited(loginKey, { max: 8, windowMs: 10 * 60 * 1000 })) {
        return sendJson(res, 429, { error: 'تلاش‌های ورود ناموفق بیش از حد مجاز بوده است. چند دقیقه دیگر دوباره تلاش کنید.' });
      }

      const users = db.getUsers();
      const user = users[phone];
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        recordAttempt(loginKey, 10 * 60 * 1000);
        return sendJson(res, 401, { error: 'شماره موبایل یا رمز عبور اشتباه است.' });
      }

      clearAttempts(loginKey);
      createSessionFor(res, phone);
      return sendJson(res, 200, { user: publicUser(user) });
    }

    // ---------------- Logout ----------------
    if (req.method === 'POST' && url === '/api/auth/logout') {
      const cookies = parseCookies(req);
      const token = cookies['session_token'];
      if (token) {
        const sessions = db.getSessions();
        delete sessions[token];
        db.saveSessions(sessions);
      }
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Forgot password: step 1 — request a 4-digit code ----------------
    if (req.method === 'POST' && url === '/api/auth/forgot/request') {
      // Throttle per phone+IP: without this, anyone can hammer this
      // endpoint to spam an SMS gateway (once one is connected) or to
      // brute-force which phone numbers are registered (see 404 below).
      const reqKey = `forgot-req:${clientIp}`;
      if (isRateLimited(reqKey, { max: 6, windowMs: 15 * 60 * 1000 })) {
        return sendJson(res, 429, { error: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' });
      }
      recordAttempt(reqKey, 15 * 60 * 1000);

      const body = await readJsonBody(req);
      const phone = (body.phone || '').trim();

      if (!isValidIranianMobile(phone)) {
        return sendJson(res, 400, { error: 'شماره موبایل معتبر نیست.' });
      }

      const users = db.getUsers();
      if (!users[phone]) {
        // Same response shape regardless of whether the phone is registered
        // would be even stronger against enumeration, but this app's UI
        // depends on the distinct message — kept as-is, just rate-limited.
        return sendJson(res, 404, { error: 'حسابی با این شماره موبایل پیدا نشد.' });
      }

      const code = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit code
      const codes = db.getResetCodes();
      codes[phone] = { code, expiresAt: Date.now() + 2 * 60 * 1000, attempts: 0 }; // 2 minutes, max 5 verify attempts
      db.saveResetCodes(codes);

      // TODO: send `code` via a real SMS gateway (e.g. Kavenegar, Melipayamak, ...) once one
      // is connected — this is left empty for now since no SMS service is wired up yet.
      //
      // SECURITY: `devCode` below lets the reset flow be tested end-to-end without a real
      // SMS gateway, but it must never be echoed back once this goes to production — doing
      // so would let anyone reset any account's password just by knowing their phone number.
      // It is gated behind NODE_ENV so a production deploy (NODE_ENV=production) never
      // exposes it; still remove this field entirely once a real gateway is wired up.
      const payload = { ok: true };
      if (!IS_PRODUCTION) payload.devCode = code;
      return sendJson(res, 200, payload);
    }

    // ---------------- Forgot password: step 2 — verify code + set new password ----------------
    if (req.method === 'POST' && url === '/api/auth/forgot/verify') {
      const body = await readJsonBody(req);
      const phone = (body.phone || '').trim();
      const code = (body.code || '').trim();
      const newPassword = body.newPassword || '';

      if (!isValidIranianMobile(phone)) {
        return sendJson(res, 400, { error: 'شماره موبایل معتبر نیست.' });
      }
      if (!newPassword || newPassword.length < 6) {
        return sendJson(res, 400, { error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });
      }

      const codes = db.getResetCodes();
      const entry = codes[phone];

      // Cap verify attempts per code so a 4-digit code (10,000 possibilities)
      // can't just be brute-forced within its 2-minute lifetime.
      if (entry && (entry.attempts || 0) >= 5) {
        delete codes[phone];
        db.saveResetCodes(codes);
        return sendJson(res, 400, { error: 'تعداد تلاش‌های مجاز برای این کد به پایان رسید. دوباره کد جدید درخواست کنید.' });
      }

      if (!entry || Date.now() > entry.expiresAt || entry.code !== code) {
        if (entry) {
          entry.attempts = (entry.attempts || 0) + 1;
          db.saveResetCodes(codes);
        }
        return sendJson(res, 400, { error: 'کد وارد شده نادرست یا منقضی شده است.' });
      }

      const users = db.getUsers();
      const user = users[phone];
      if (!user) {
        return sendJson(res, 404, { error: 'حسابی با این شماره موبایل پیدا نشد.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      user.passwordHash = hash;
      user.passwordSalt = salt;
      users[phone] = user;
      db.saveUsers(users);

      delete codes[phone];
      db.saveResetCodes(codes);

      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Current logged-in user ----------------
    if (req.method === 'GET' && url === '/api/auth/me') {
      const user = getSessionUser(req);
      return sendJson(res, 200, { user: publicUser(user) });
    }

    // ---------------- Update profile ----------------
    if (req.method === 'PUT' && url === '/api/auth/profile') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: 'ابتدا وارد حساب خود شوید.' });

      const body = await readJsonBody(req);
      const firstName = (body.firstName || '').trim().slice(0, 60) || user.firstName;
      const lastName  = (body.lastName || '').trim().slice(0, 60) || user.lastName;
      const email     = (body.email || '').trim().slice(0, 120);
      const address   = (body.address || '').trim().slice(0, 500);
      const newPhone  = (body.phone || '').trim() || user.phone;

      if (!isValidIranianMobile(newPhone)) {
        return sendJson(res, 400, { error: 'شماره موبایل معتبر نیست.' });
      }

      const users = db.getUsers();
      if (newPhone !== user.phone && users[newPhone]) {
        return sendJson(res, 409, { error: 'این شماره قبلاً برای حساب دیگری ثبت شده است.' });
      }

      const updated = { ...user, firstName, lastName, email, address, phone: newPhone };

      if (newPhone !== user.phone) {
        delete users[user.phone];
        users[newPhone] = updated;

        // keep this session pointed at the new phone key
        const cookies = parseCookies(req);
        const token = cookies['session_token'];
        if (token) {
          const sessions = db.getSessions();
          if (sessions[token]) {
            sessions[token].phone = newPhone;
            db.saveSessions(sessions);
          }
        }
      } else {
        users[user.phone] = updated;
      }
      db.saveUsers(users);

      return sendJson(res, 200, { user: publicUser(updated) });
    }

    // ---------------- Create order (call this only AFTER payment succeeds) ----------------
    if (req.method === 'POST' && url === '/api/orders') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: 'برای ثبت سفارش ابتدا وارد حساب کاربری خود شوید.' });

      const body = await readJsonBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const address = (body.address || '').trim().slice(0, 500);

      if (!items.length) return sendJson(res, 400, { error: 'سبد خرید خالی است.' });
      if (items.length > 50) return sendJson(res, 400, { error: 'تعداد اقلام سبد خرید بیش از حد مجاز است.' });
      if (!address) return sendJson(res, 400, { error: 'آدرس ارسال الزامی است.' });

      // SECURITY: never trust a price sent by the client — a shopper's
      // browser could submit any `price` it likes. Every item's price is
      // instead looked up server-side from the product catalog (the same
      // file the product page itself renders from) by product name, and
      // that catalog price is what actually gets charged/recorded. Items
      // that don't match a known catalog product are rejected outright
      // rather than trusted at face value.
      const cleanItems = [];
      for (const it of items) {
        const name = String(it.name || '').trim().slice(0, 200);
        const qty = Math.min(20, Math.max(1, Math.floor(Number(it.qty)) || 1));

        // The client appends a "(رنگ: ... - حافظه: ...)" variant suffix to
        // the product name for display (see site.js's buy-now handler) —
        // match the catalog on the bare product name first, falling back
        // to an exact match for items with no variant suffix.
        const baseName = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const canonicalPrice = PRICE_BY_NAME.has(baseName)
          ? PRICE_BY_NAME.get(baseName)
          : PRICE_BY_NAME.get(name);

        if (!name || canonicalPrice === undefined) {
          return sendJson(res, 400, { error: `کالای «${name || 'ناشناخته'}» در فروشگاه پیدا نشد.` });
        }

        cleanItems.push({
          name,
          price: canonicalPrice,
          qty,
          color: String(it.color || '').trim().slice(0, 60),
          storage: String(it.storage || '').trim().slice(0, 60)
        });
      }
      const total = cleanItems.reduce((sum, it) => sum + it.price * it.qty, 0);

      const order = {
        id: randomId('ORD'),
        phone: user.phone,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        address,
        items: cleanItems,
        total,
        status: 'در حال پردازش',
        createdAt: new Date().toISOString()
      };

      const orders = db.getOrders();
      orders.push(order);
      db.saveOrders(orders);

      return sendJson(res, 201, { order });
    }

    // ---------------- List the logged-in user's own past orders ----------------
    if (req.method === 'GET' && url === '/api/orders/mine') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: 'ابتدا وارد حساب خود شوید.' });

      const orders = db.getOrders()
        .filter(o => o.phone === user.phone)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return sendJson(res, 200, { orders });
    }

    // ---------------- Cart (private, per logged-in user) ----------------
    if (req.method === 'GET' && url === '/api/cart') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 200, { items: [] }); // guests use localStorage instead
      const carts = db.getCarts();
      return sendJson(res, 200, { items: carts[user.phone] || [] });
    }
    if (req.method === 'PUT' && url === '/api/cart') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: 'ابتدا وارد حساب خود شوید.' });
      const body = await readJsonBody(req);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50);
      const carts = db.getCarts();
      carts[user.phone] = items;
      db.saveCarts(carts);
      return sendJson(res, 200, { items });
    }

    // ---------------- Wishlist (private, per logged-in user) ----------------
    if (req.method === 'GET' && url === '/api/wishlist') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 200, { items: [] }); // guests use localStorage instead
      const wishlists = db.getWishlists();
      return sendJson(res, 200, { items: wishlists[user.phone] || [] });
    }
    if (req.method === 'PUT' && url === '/api/wishlist') {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 401, { error: 'ابتدا وارد حساب خود شوید.' });
      const body = await readJsonBody(req);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 100);
      const wishlists = db.getWishlists();
      wishlists[user.phone] = items;
      db.saveWishlists(wishlists);
      return sendJson(res, 200, { items });
    }

    // ---------------- Reviews (public — shared by every visitor) ----------------
    if (req.method === 'GET' && url === '/api/reviews') {
      const productId = query.get('product') || 'default';
      // `productId` becomes an object key that gets JSON-persisted below —
      // reject anything that isn't a safe id (blocks __proto__/constructor/
      // prototype pollution attempts and keeps the reviews file tidy).
      if (!isSafeObjectKey(productId)) return sendJson(res, 400, { error: 'شناسه محصول نامعتبر است.' });
      const reviews = db.getReviews();
      return sendJson(res, 200, { items: reviews[productId] || [] });
    }
    if (req.method === 'POST' && url === '/api/reviews') {
      const productId = query.get('product') || 'default';
      if (!isSafeObjectKey(productId)) return sendJson(res, 400, { error: 'شناسه محصول نامعتبر است.' });

      // Cheap anti-spam throttle: limit how many reviews one IP can post
      // in a short window (this endpoint has no login requirement).
      const reviewKey = 'review:' + clientIp;
      if (isRateLimited(reviewKey, { max: 10, windowMs: 10 * 60 * 1000 })) {
        return sendJson(res, 429, { error: 'تعداد نظرات ارسالی بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.' });
      }

      const body = await readJsonBody(req);
      const name = (body.name || '').trim().slice(0, 60);
      const text = (body.text || '').trim().slice(0, 1000);
      const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));

      if (!name || !text || !rating) {
        return sendJson(res, 400, { error: 'نام، متن نظر و امتیاز الزامی است.' });
      }

      recordAttempt(reviewKey, 10 * 60 * 1000);

      const reviews = db.getReviews();
      if (!reviews[productId]) reviews[productId] = [];
      const review = { name, text, rating, createdAt: new Date().toISOString() };
      reviews[productId].unshift(review);
      db.saveReviews(reviews);

      return sendJson(res, 201, { review, items: reviews[productId] });
    }

    // ---------------- Admin: login ----------------
    if (req.method === 'POST' && url === '/api/admin/login') {
      // The admin panel is the highest-value target in this app — throttle
      // it harder than regular user login, and by IP alone (there's only
      // one admin account, so throttling by username would be pointless).
      const adminKey = 'admin-login:' + clientIp;
      if (isRateLimited(adminKey, { max: 5, windowMs: 15 * 60 * 1000 })) {
        return sendJson(res, 429, { error: 'تلاش‌های ورود ناموفق بیش از حد مجاز بوده است. چند دقیقه دیگر دوباره تلاش کنید.' });
      }

      const body = await readJsonBody(req);
      const username = (body.username || '').trim();
      const password = body.password || '';

      const validUsername = username === ADMIN_USERNAME;
      const validPassword = validUsername && verifyPassword(password, ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_HASH);

      if (!validUsername || !validPassword) {
        recordAttempt(adminKey, 15 * 60 * 1000);
        return sendJson(res, 401, { error: 'نام کاربری یا رمز عبور ادمین اشتباه است.' });
      }

      clearAttempts(adminKey);
      const token = createToken();
      const sessions = db.getAdminSessions();
      sessions[token] = { createdAt: new Date().toISOString() };
      db.saveAdminSessions(sessions);
      setAdminSessionCookie(res, token);

      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Admin: logout ----------------
    if (req.method === 'POST' && url === '/api/admin/logout') {
      const cookies = parseCookies(req);
      const token = cookies['admin_session'];
      if (token) {
        const sessions = db.getAdminSessions();
        delete sessions[token];
        db.saveAdminSessions(sessions);
      }
      clearAdminSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Admin: am I logged in? ----------------
    if (req.method === 'GET' && url === '/api/admin/me') {
      return sendJson(res, 200, { authed: isAdminAuthed(req) });
    }

    // ---------------- Admin: all orders, newest first ----------------
    if (req.method === 'GET' && url === '/api/admin/orders') {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });
      const orders = db.getOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJson(res, 200, { orders });
    }

    // ---------------- Admin: all users (never includes password hash/salt) ----------------
    if (req.method === 'GET' && url === '/api/admin/users') {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });
      const activePhones = getActivePhones();
      const users = Object.values(db.getUsers())
        .map(u => ({
          firstName: u.firstName, lastName: u.lastName, phone: u.phone,
          email: u.email || '', address: u.address || '', createdAt: u.createdAt,
          isActive: activePhones.has(u.phone)
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return sendJson(res, 200, { users });
    }

    // ---------------- Admin: change an order's status ----------------
    const orderStatusMatch = url.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
    if (req.method === 'PATCH' && orderStatusMatch) {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });

      const orderId = decodeURIComponent(orderStatusMatch[1]);
      const body = await readJsonBody(req);
      const VALID_STATUSES = ['در حال پردازش', 'در حال ارسال', 'تحویل شده'];
      const status = body.status;

      if (!VALID_STATUSES.includes(status)) {
        return sendJson(res, 400, { error: 'وضعیت نامعتبر است.' });
      }

      const orders = db.getOrders();
      const order = orders.find(o => o.id === orderId);
      if (!order) return sendJson(res, 404, { error: 'سفارش پیدا نشد.' });

      order.status = status;
      db.saveOrders(orders);
      return sendJson(res, 200, { order });
    }

    // ---------------- Admin: delete an order ----------------
    const orderDeleteMatch = url.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (req.method === 'DELETE' && orderDeleteMatch) {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });

      const orderId = decodeURIComponent(orderDeleteMatch[1]);
      const orders = db.getOrders();
      const index = orders.findIndex(o => o.id === orderId);
      if (index === -1) return sendJson(res, 404, { error: 'سفارش پیدا نشد.' });

      orders.splice(index, 1);
      db.saveOrders(orders);
      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Admin: delete a user account ----------------
    const userDeleteMatch = url.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (req.method === 'DELETE' && userDeleteMatch) {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });

      const phone = decodeURIComponent(userDeleteMatch[1]);
      const users = db.getUsers();
      if (!users[phone]) return sendJson(res, 404, { error: 'کاربر پیدا نشد.' });
      delete users[phone];
      db.saveUsers(users);

      // Also clean up anything tied to this account so no orphaned data is left behind.
      const sessions = db.getSessions();
      Object.keys(sessions).forEach(token => {
        if (sessions[token].phone === phone) delete sessions[token];
      });
      db.saveSessions(sessions);

      const carts = db.getCarts(); delete carts[phone]; db.saveCarts(carts);
      const wishlists = db.getWishlists(); delete wishlists[phone]; db.saveWishlists(wishlists);

      return sendJson(res, 200, { ok: true });
    }

    // ---------------- Admin: reset the static-file speed cache ----------------
    if (req.method === 'POST' && url === '/api/admin/cache/reset') {
      if (!isAdminAuthed(req)) return sendJson(res, 401, { error: 'ابتدا وارد پنل مدیریت شوید.' });
      const cleared = clearStaticCache();
      return sendJson(res, 200, { ok: true, cleared, resetAt: new Date().toISOString() });
    }

    // ---------------- Static site files ----------------
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'خطای داخلی سرور' });
  }
});

server.listen(PORT, () => {
  console.log(`✅ MobileGSM server running at http://localhost:${PORT}`);
});

// Auto-reset the static file cache every 24 hours (also resettable manually
// from the admin panel). Keeps memory usage bounded and guarantees the cache
// never serves content older than a day, even if it's never cleared by hand.
setInterval(() => {
  const cleared = clearStaticCache();
  console.log(`🔄 Static file cache auto-reset (${cleared} entries cleared)`);
}, 24 * 60 * 60 * 1000);
