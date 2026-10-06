var C = 'deal-calculator-v9', F = ['./', 'index.html', 'privacy.html', 'calc.js', 'pdf.js', 'app.js', 'manifest.webmanifest', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'fonts/Geist-Variable.woff2', 'fonts/InstrumentSerif-Regular.woff2', 'fonts/InstrumentSerif-Italic.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(C).then(function (c) { return c.addAll(F); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== C; }).map(function (x) { return caches.delete(x); })); })); });
// A request with a throwaway "?_=<time>" or "?v=N" is stored under the plain address, so the offline fallback can find
// it whatever the throwaway was.
function keyOf(req) { var u = new URL(req.url); return u.origin + u.pathname; }
// Network first so edits show up. Every good same-site answer is also stored, so the pages already opened still work
// with no signal. Other sites are left alone.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(C).then(function (c) { c.put(keyOf(req), copy); }); }
    return res;
  }).catch(function () { return caches.match(keyOf(req)); }));
});
