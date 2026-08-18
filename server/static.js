const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Same security headers server.js applies to JSON API responses — kept in
// sync manually since this file has no dependency on server.js (and vice
// versa) to avoid a circular require.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg'
};

// Text formats compress very well with gzip (often 60-80% smaller over the wire).
// Images are already compressed formats, so gzipping them again wastes CPU for no gain.
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg']);

const ROOT = path.join(__dirname, '..');

// These must NEVER be reachable over HTTP — they hold user data (including
// password hashes), order addresses, and the server's own source code.
// Regular website visitors should only ever get the front-end files below.
const BLOCKED_PREFIXES = ['/data/', '/server/', '/node_modules/', '/.git/'];
const BLOCKED_FILES = new Set([
  '/server.js', '/package.json', '/package-lock.json',
  '/README-backend.md', '/COMMANDS.md'
]);

function isBlocked(urlPath) {
  if (BLOCKED_FILES.has(urlPath)) return true;
  return BLOCKED_PREFIXES.some(prefix => urlPath.startsWith(prefix));
}

// In-memory cache of already-compressed/prepared responses, keyed by "urlPath::gzip|raw".
// This avoids re-reading the file from disk and re-running gzip on every single
// request. Entries auto-invalidate if the underlying file's mtime changes, and
// can also be wiped on demand (see clearStaticCache) — e.g. from the admin panel,
// or automatically every 24h from server.js.
const responseCache = new Map();

function clearStaticCache() {
  const count = responseCache.size;
  responseCache.clear();
  return count;
}

function cacheControlFor(ext) {
  // HTML can change often (new pages, fixes) — always revalidate.
  if (ext === '.html') return 'no-cache';
  // CSS/JS/images rarely change day-to-day — let the browser cache them for a while,
  // so a returning visitor doesn't re-download the whole site on every page.
  return 'public, max-age=86400'; // 1 day
}

function withSecurityHeaders(headers) {
  return Object.assign({}, SECURITY_HEADERS, headers);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Clean URLs across the whole site: /account, /cart, /product, etc. instead
  // of exposing the .html filename in the address bar. Trailing slash is
  // tolerated too (/cart/ works the same as /cart).
  const CLEAN_ROUTES = {
    '/admin': '/admin.html',
    '/about': '/about.html',
    '/account': '/account.html',
    '/cart': '/cart.html',
    '/checkout': '/checkout.html',
    '/order-success': '/order-success.html',
    '/product': '/product.html',
  };
  const noTrailingSlash = urlPath.length > 1 ? urlPath.replace(/\/$/, '') : urlPath;
  if (CLEAN_ROUTES[noTrailingSlash]) urlPath = CLEAN_ROUTES[noTrailingSlash];

  const filePath = path.normalize(path.join(ROOT, urlPath));

  // Prevent path traversal outside the project root. A plain
  // `filePath.startsWith(ROOT)` is NOT sufficient here: it would also match
  // a sibling directory whose name happens to start with the same string,
  // e.g. ROOT "/srv/app" would wrongly accept "/srv/app-secret/file" since
  // that string literally starts with "/srv/app". Requiring the next
  // character to be the path separator (or an exact match) closes that gap.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, withSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('دسترسی غیرمجاز');
    return;
  }

  // IMPORTANT: the blocklist must be checked against the *normalized,
  // resolved* path — not the raw request path — or a request like
  // "/product/../server/db.js" would sail through this check (it doesn't
  // start with "/server/") and then get normalized into the blocked
  // server/ folder afterwards, serving up source code and the JSON data
  // files (including password hashes) straight past the blocklist.
  const rootRelativePath = '/' + path.relative(ROOT, filePath).split(path.sep).join('/');
  if (isBlocked(rootRelativePath)) {
    res.writeHead(404, withSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('صفحه مورد نظر پیدا نشد');
    return;
  }

  const ext = path.extname(filePath);
  if (!MIME[ext]) {
    // Allowlist only — any extension not explicitly listed above (e.g. .json) is refused.
    res.writeHead(404, withSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('صفحه مورد نظر پیدا نشد');
    return;
  }

  const wantsGzip = COMPRESSIBLE.has(ext) && (req.headers['accept-encoding'] || '').includes('gzip');
  const cacheKey = urlPath + (wantsGzip ? '::gz' : '::raw');

  fs.stat(filePath, (statErr, stat) => {
    if (statErr) {
      res.writeHead(404, withSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('صفحه مورد نظر پیدا نشد');
      return;
    }

    const cached = responseCache.get(cacheKey);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      res.writeHead(200, cached.headers);
      res.end(cached.buffer);
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, withSecurityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
        res.end('صفحه مورد نظر پیدا نشد');
        return;
      }

      const headers = withSecurityHeaders({ 'Content-Type': MIME[ext], 'Cache-Control': cacheControlFor(ext) });

      if (wantsGzip) {
        zlib.gzip(data, (gzErr, gzipped) => {
          const buffer = gzErr ? data : gzipped;
          if (!gzErr) { headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
          responseCache.set(cacheKey, { mtimeMs: stat.mtimeMs, headers, buffer });
          res.writeHead(200, headers);
          res.end(buffer);
        });
        return;
      }

      responseCache.set(cacheKey, { mtimeMs: stat.mtimeMs, headers, buffer: data });
      res.writeHead(200, headers);
      res.end(data);
    });
  });
}

module.exports = serveStatic;
module.exports.clearStaticCache = clearStaticCache;
