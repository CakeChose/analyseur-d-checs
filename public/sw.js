// Service worker : garde le site en cache pour qu'il marche hors ligne (version installée).
// - Pages : réseau d'abord, pour avoir toujours la dernière version ; cache si hors ligne.
// - Autres fichiers du site (JS, CSS, moteur, ouvertures) : cache d'abord, mis à jour en arrière-plan.
// - API chess.com / Lichess (autre domaine) : pas touchées, réseau seulement.
// shortcut: les anciens fichiers (noms avec empreinte) restent en cache ; vider par version si le cache grossit trop.
const CACHE = 'analyseur-echecs';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const network = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  if (req.mode === 'navigate') {
    e.respondWith(network.catch(() => caches.match(req).then((hit) => hit || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || network));
  e.waitUntil(network.then(
    () => {},
    () => {},
  ));
});
