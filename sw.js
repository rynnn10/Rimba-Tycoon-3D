const CACHE_NAME = "rimba-tycoon-v8";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.json",
];

// 1. INSTALL: Cache assets awal
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Bersihkan cache lama jika ada
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Strategy "Network First" untuk kode, "Cache First" untuk aset
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jika request adalah file Game Logic (HTML, CSS, JS), gunakan NETWORK FIRST
  // Ini agar setiap update di GitHub langsung terambil user.
  if (
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Jika online dan berhasil ambil, update cache
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Jika offline, ambil dari cache
          return caches.match(event.request);
        })
    );
  } else {
    // Untuk Aset (Gambar, Model 3D, Suara), gunakan CACHE FIRST (Performa)
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
