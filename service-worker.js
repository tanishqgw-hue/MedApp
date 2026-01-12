const CACHE = "meds-pwa-v1";

const ASSETS = [
  "/MedApp/",
  "/MedApp/index.html",
  "/MedApp/style.css",
  "/MedApp/app.js",
  "/MedApp/manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
