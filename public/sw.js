/**
 * Syncwrite service worker — app-shell caching for offline reloads.
 *
 * The app is already local-first (IndexedDB is the source of truth for document
 * content). This SW closes the last gap: a *full page reload* while offline.
 * Without it, the browser must re-fetch the HTML/JS from the server and shows
 * the "no internet" page. With it, the shell is served from cache and the app
 * boots offline, after which IndexedDB drives the editor.
 *
 * Strategy:
 *  - Navigations (page loads/reloads): network-first, cache the result, fall
 *    back to the cached page — or any cached page — when offline.
 *  - Hashed static assets (/_next/static, fonts, images): cache-first; they are
 *    immutable so a cache hit is always correct and instant.
 *  - Everything else GET: network-first with a cache fallback.
 *  - /api/* is never cached — auth/sync/AI must always hit the network and fail
 *    gracefully offline (the app's sync queue handles that).
 */

const VERSION = "v1";
const STATIC_CACHE = `sw-static-${VERSION}`;
const PAGE_CACHE = `sw-pages-${VERSION}`;
const CACHES = [STATIC_CACHE, PAGE_CACHE];

self.addEventListener("install", () => {
  // Activate this SW immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // only same-origin
  if (url.pathname.startsWith("/api/")) return; // never cache API/auth/sync/AI

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  const isImmutable =
    url.pathname.startsWith("/_next/static") ||
    /\.(?:css|js|woff2?|ttf|png|jpe?g|gif|svg|ico|webp)$/.test(url.pathname);

  event.respondWith(isImmutable ? cacheFirst(request) : networkFirst(request, PAGE_CACHE));
});

/** Network-first for full page loads; serve cached shell when offline. */
async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fall back to any previously-cached page so the app still boots offline.
    const anyPage = (await cache.keys())[0];
    if (anyPage) return cache.match(anyPage);
    return Response.error();
  }
}

/** Cache-first for immutable, hashed assets. */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Network-first with cache fallback for everything else (e.g. RSC payloads). */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}
