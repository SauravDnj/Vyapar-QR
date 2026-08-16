// Minimal service worker — its only job is to be present and controlling
// the page, which is a hard requirement for Chrome/Android's install
// (`beforeinstallprompt`) eligibility. No offline caching is attempted here;
// every request just falls through to the network as normal.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Intentionally no-op — pass through to the network.
});
