/* Offline cache. Bump CACHE when any file changes so phones pick up the new version. */
var CACHE = "balancing-calc-v3.0.0";
var ASSETS = ["./", "index.html", "styles.css", "app.js", "calc.js", "fmt.js", "data.js", "manifest.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(caches.match("index.html").then(function (r) { return r || fetch(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      if (resp && resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); }
      return resp;
    });
  }));
});
