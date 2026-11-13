// Atlas Dashboard service worker — app-shell cache only.
//
// Caches the dashboard page + icons so the app shell loads offline.
// API calls (/status, /events, /latest.png, /api/*, /mcp) are NEVER cached:
// they always go to the network, so the dashboard never shows stale live
// data. Version the cache name when the shell changes.
const CACHE = "atlas-dashboard-v1";
const SHELL = [
  "/dashboard/",
  "/dashboard/index.html",
  "/dashboard/manifest.json",
  "/dashboard/icon-192.png",
  "/dashboard/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Live data always comes from the network.
  if (
    url.pathname === "/status" ||
    url.pathname === "/api/status" ||
    url.pathname === "/latest.png" ||
    url.pathname === "/events" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/mcp"
  ) {
    return; // default fetch behaviour (network)
  }
  if (url.pathname.startsWith("/dashboard/")) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          }),
      ),
    );
  }
});
