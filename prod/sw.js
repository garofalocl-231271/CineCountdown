const SW_VERSION = "prod-1.0.0";
const CACHE_NAME = "cinecountdown-prod-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

/* =========================
   NOTIFICA PUSH
========================= */

self.addEventListener("message", event => {
  if (event.data?.type === "NOTIFY") {
    const { title, body } = event.data.payload;

    self.registration.showNotification(title, {
      body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "cinecountdown",
      requireInteraction: true
    });
  }
});
