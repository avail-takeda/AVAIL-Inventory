const CACHE="avail-inventory-v6";const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./icon-192.svg","./icon-512.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(a=>Promise.all(a.filter(k=>k!==CACHE).map(k=>caches.delete(k))))) ;self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method==="GET")e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})