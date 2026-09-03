const CACHE = "avail-inventory-v15";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./avail-logo.png",
  "./icon-192.svg",
  "./icon-512.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  const isAppFile =
    url.origin === location.origin &&
    /\.(html|js|css|json|png|svg)$/i.test(url.pathname);

  if(isAppFile || req.mode === "navigate"){
    event.respondWith(
      fetch(req, {cache: "no-store"})
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
  } else {
    event.respondWith(
      caches.match(req).then(r => r || fetch(req))
    );
  }
});
