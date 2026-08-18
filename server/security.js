// Lightweight, dependency-free security helpers shared by server.js.
// Kept deliberately simple (in-memory, single-process) to match the rest
// of this project's "no external packages" approach.

const crypto = require('node:crypto');

// ---------------- Client IP ----------------
// Note: req.socket.remoteAddress is the only IP we can trust by default.
// If this app is ever deployed behind a reverse proxy (nginx, Cloudflare...),
// make sure that proxy is configured to strip/overwrite any inbound
// X-Forwarded-For header before it reaches Node, and read the real client
// IP from the proxy's trusted header instead of the socket.
function getClientIp(req) {
  return req.socket && req.socket.remoteAddress || 'unknown';
}

// ---------------- Rate limiting / brute-force lockout ----------------
// A tiny in-memory sliding-window limiter: `key` is whatever you want to
// throttle by (IP, phone number, IP+phone, ...). Not shared across
// multiple processes/machines — fine for this single-process app.
const attemptLog = new Map(); // key -> array of timestamps (ms)

function isRateLimited(key, { max, windowMs }) {
  const now = Date.now();
  const list = (attemptLog.get(key) || []).filter(ts => now - ts < windowMs);
  attemptLog.set(key, list);
  return list.length >= max;
}

function recordAttempt(key, windowMs) {
  const now = Date.now();
  const list = (attemptLog.get(key) || []).filter(ts => now - ts < windowMs);
  list.push(now);
  attemptLog.set(key, list);
}

function clearAttempts(key) {
  attemptLog.delete(key);
}

// Periodically drop old entries so this Map can't grow forever.
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 60 * 60 * 1000; // 1 hour — longer than any window we use
  for (const [key, list] of attemptLog.entries()) {
    const fresh = list.filter(ts => now - ts < MAX_AGE);
    if (fresh.length) attemptLog.set(key, fresh);
    else attemptLog.delete(key);
  }
}, 15 * 60 * 1000).unref();

// ---------------- Safe object keys (anti prototype-pollution) ----------------
// Several endpoints use a user-supplied string (e.g. a review's product id)
// as a plain-object key that later gets JSON-persisted. `__proto__`,
// `constructor` and `prototype` are dangerous keys in plain JS objects, so
// reject anything that isn't a short, plain alphanumeric/dash/underscore id.
const SAFE_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeObjectKey(key) {
  return typeof key === 'string' && SAFE_KEY_RE.test(key) && !FORBIDDEN_KEYS.has(key);
}

// ---------------- Misc ----------------
function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

module.exports = {
  getClientIp, isRateLimited, recordAttempt, clearAttempts,
  isSafeObjectKey, randomId
};
