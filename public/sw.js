const CACHE_NAME = "uec-timetable-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./data/all_subjects.json",
  "./data/category_aliases.json",
  "./data/graduation_requirements.json",
  "./data/promotion_requirements.json",
  "./data/subject_aliases.json",
  "./data/uec_timetable_entries_2026.json"
];

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

const cacheShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch("./index.html", { cache: "reload" });
  const indexText = await indexResponse.clone().text();
  const builtAssets = Array.from(indexText.matchAll(/(?:src|href)="\.\/([^"]+\.(?:js|css))"/g)).map((match) => `./${match[1]}`);
  await cache.addAll([...APP_SHELL, ...builtAssets]);
  await cache.put("./index.html", indexResponse);
};

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
