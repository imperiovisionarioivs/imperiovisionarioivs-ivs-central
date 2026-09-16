// Cache version — bump this on any change to caching behavior so old
// caches (which may hold responses cached under a previous, less strict
// policy) are deleted on activate rather than lingering forever.
const CACHE = "ivs-central-v2";

// Only ever precache assets that are public and contain no user data.
// "/" is deliberately NOT precached: it requires a session (middleware
// redirects to /login otherwise) and its content differs per user.
const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/ivs-192.png",
  "/icons/ivs-512.png",
  "/icons/ivs-maskable-512.png",
];

// Path prefixes that are safe to cache-first: build output and icons only.
// Nothing here can contain a user's data — it's the same for every visitor.
const CACHEABLE_STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const CACHEABLE_STATIC_EXACT = ["/manifest.webmanifest", "/ivs-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => {
        // Do not hide install failures — they mean the offline fallback
        // and/or icons may be missing until the next successful install.
        console.error("[sw] precache failed", err);
        throw err;
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Delete every cache that isn't the current version — this
            // guarantees any page (including authenticated ones) that a
            // previous version of this service worker may have cached
            // gets purged, not just superseded.
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableStatic(pathname) {
  if (CACHEABLE_STATIC_EXACT.includes(pathname)) return true;
  return CACHEABLE_STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle GET — never intercept mutations.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch cross-origin requests (analytics, fonts from a CDN, etc.):
  // let the browser handle those with its own defaults. This also means
  // we never accidentally cache a third-party response under our own
  // cache name.
  if (url.origin !== self.location.origin) return;

  // Never cache or intercept API routes, auth routes, or anything that
  // could carry a user's private data or session state. These always go
  // straight to the network with no service-worker involvement.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // Public, user-agnostic static assets: cache-first.
  if (isCacheableStatic(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Everything else — every app page (dashboard, CRM, clientes, RSC data
  // fetches, etc.) — is potentially private and/or per-user. We NEVER
  // cache these responses. For a top-level navigation, if the network is
  // unavailable we fall back to the public, pre-cached /offline page
  // instead of ever risking serving stale authenticated HTML. Any other
  // request type (RSC payload fetches, prefetches) that fails offline is
  // left to fail normally — there is nothing safe to serve instead.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline");
        return (
          offline ||
          new Response("Offline", { status: 503, statusText: "Offline" })
        );
      })
    );
  }
  // Non-navigation, non-static, non-API requests: no special handling —
  // pass through to the network untouched (default browser behavior).
});
