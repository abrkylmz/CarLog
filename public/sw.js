// CarLog service worker: opens instantly and without a connection, and shows reminder
// notifications. Bump VERSION when the caching rules change.
const VERSION = "carlog-v2";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const API = `${VERSION}-api`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/theme-init.js", "/manifest.webmanifest", "/icon-192.png", "/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, falling back to the last good copy.
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl || request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Data: always try the server; offline, show the last data seen.
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/push") || url.pathname.startsWith("/api/cron")) return;
    event.respondWith(
      networkFirst(request, API).catch(
        () =>
          new Response(JSON.stringify({ error: "Çevrimdışısınız; bu veri henüz kaydedilmemiş." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  // The page itself: fresh when online, the saved shell when not.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL, "/"));
    return;
  }

  // Built assets carry a hash in their name, so a cached copy never goes stale.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Icons and the manifest: serve the saved copy, refresh it in the background.
  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const cached = await cache.match(request);
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});

// Signing out forgets the saved data of that account.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-data") event.waitUntil(caches.delete(API));
});

// ---- Reminder notifications ----
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CarLog", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "CarLog", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        open.navigate(target).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
