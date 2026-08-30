/* Service Worker — igre rade bez interneta.
   Strategija: keš prvo (brzo i offline), a u pozadini se povlači nova verzija za sledeći put. */
const VERSION = "igre-v1";
const CORE = [
  "./",
  "./igre.html",
  "./igre.js",
  "./sudoku.html",
  "./solitaire.html",
  "./kolona.html",
  "./aparat.html",
  "./svercer.html",
  "./tetris.html",
  "./avioni.html",
  "./manifest.webmanifest",
  "./icons/igre-180.png",
  "./icons/igre-192.png",
  "./icons/igre-512.png",
  "./icons/sudoku-180.png",
  "./icons/solitaire-180.png",
  "./icons/kolona-180.png",
  "./icons/aparat-180.png",
  "./icons/svercer-180.png",
  "./icons/tetris-180.png",
  "./icons/avioni-180.png"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // pojedinačno, da jedan promašaj ne obori celu instalaciju
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => { })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;         // strane adrese ne diramo

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => { });
      return res;
    }).catch(() => null);

    if (hit) { e.waitUntil(fresh); return hit; }        // offline-first, osvežavanje u pozadini

    const res = await fresh;
    if (res) return res;

    if (req.mode === "navigate") {                     // nema mreže ni keša → vrati hub
      const fallback = await cache.match("./igre.html") || await cache.match("igre.html");
      if (fallback) return fallback;
    }
    return new Response("Offline — ova stranica nije sačuvana.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  })());
});
