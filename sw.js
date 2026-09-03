/* Igre su preseljene na https://brankojosipovic.github.io/igre/ — ovaj radnik je
   ostao samo da na telefonima koji ga još imaju obriše stari keš i odjavi sebe.
   Border Wait ga ne koristi. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    /* Samo stari kešovi ove adrese — novi sajt igara deli isto skladište
       (ista adresa, druga fascikla) i njegov keš se ne sme dirati. */
    const keys = await caches.keys();
    const moji = keys.filter(k => /^igre-v\d+$/.test(k));
    await Promise.all(moji.map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: "window" });
    for (const c of cs) { try { c.navigate(c.url); } catch (err) { } }
  })());
});
