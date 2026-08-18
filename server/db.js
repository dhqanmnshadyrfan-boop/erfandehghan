// Plain JSON-file storage — no SQLite, no external packages, works on any
// reasonably modern Node.js version (no experimental modules, no version floor).

const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const usersFile = path.join(dataDir, 'users.json');
const sessionsFile = path.join(dataDir, 'sessions.json');

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  // Write to a temp file then rename over the target — an atomic operation
  // on the same filesystem. Without this, a crash or power loss mid-write
  // (fs.writeFileSync isn't atomic on its own) can leave a truncated/corrupt
  // JSON file that every subsequent read of that file would then fail on.
  const tmpFile = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, file);
}

// users: { [phone]: { phone, firstName, lastName, email, address, passwordHash, passwordSalt, createdAt } }
function getUsers() { return readJson(usersFile, {}); }
function saveUsers(users) { writeJson(usersFile, users); }

// sessions: { [token]: { phone, createdAt } }
function getSessions() { return readJson(sessionsFile, {}); }
function saveSessions(sessions) { writeJson(sessionsFile, sessions); }

// orders: [ { id, phone, fullName, address, items, total, status, createdAt } ]
const ordersFile = path.join(dataDir, 'orders.json');
function getOrders() { return readJson(ordersFile, []); }
function saveOrders(orders) { writeJson(ordersFile, orders); }

// carts: { [phone]: [ { name, price, qty, image, colorClass } ] }
const cartsFile = path.join(dataDir, 'carts.json');
function getCarts() { return readJson(cartsFile, {}); }
function saveCarts(carts) { writeJson(cartsFile, carts); }

// wishlists: { [phone]: [ { name, price, image, link } ] }
const wishlistsFile = path.join(dataDir, 'wishlists.json');
function getWishlists() { return readJson(wishlistsFile, {}); }
function saveWishlists(wishlists) { writeJson(wishlistsFile, wishlists); }

// reviews: { [productId]: [ { name, text, rating, createdAt } ] } — public, shared by everyone
const reviewsFile = path.join(dataDir, 'reviews.json');
function getReviews() { return readJson(reviewsFile, {}); }
function saveReviews(reviews) { writeJson(reviewsFile, reviews); }

// password reset codes: { [phone]: { code, expiresAt } }
const resetCodesFile = path.join(dataDir, 'reset-codes.json');
function getResetCodes() { return readJson(resetCodesFile, {}); }
function saveResetCodes(codes) { writeJson(resetCodesFile, codes); }

// admin sessions: { [token]: { createdAt } } — completely separate from user sessions
const adminSessionsFile = path.join(dataDir, 'admin-sessions.json');
function getAdminSessions() { return readJson(adminSessionsFile, {}); }
function saveAdminSessions(sessions) { writeJson(adminSessionsFile, sessions); }

module.exports = {
  getUsers, saveUsers, getSessions, saveSessions, getOrders, saveOrders,
  getCarts, saveCarts, getWishlists, saveWishlists, getReviews, saveReviews,
  getResetCodes, saveResetCodes, getAdminSessions, saveAdminSessions
};
