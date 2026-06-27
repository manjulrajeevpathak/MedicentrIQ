/* HealthOS Clinician — minimal service worker.
 *
 * Goal is installability, not full offline. We pre-cache a tiny app shell and
 * serve a network-first strategy: live data wins, cache is a fallback for the
 * shell when the network is unavailable. API calls are never cached.
 */
const CACHE = "clinician-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache cross-origin requests (e.g. core-api) or API-shaped paths.
  const isApi = url.origin !== self.location.origin || /\/(auth|patients|appointments|documents|clinical)\b/.test(url.pathname);
  if (isApi) return; // let the network handle it directly

  // Network-first for same-origin navigations/assets; fall back to cache.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
