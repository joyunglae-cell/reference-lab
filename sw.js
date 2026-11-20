/* 앱 설치용 서비스 워커: 사이트 파일을 저장해 두고 오프라인에서도 열리게 합니다.
   AI·GitHub 등 외부 요청은 건드리지 않습니다. 파일을 바꾸면 VERSION을 올리세요. */
var VERSION = "reflab-v16";
var FILES = [
  "./", "./index.html", "./style.css", "./data.js", "./store.js", "./numfmt.js", "./ai.js", "./app.js", "./dash.js", "./analyze.js", "./assist.js", "./ops.js", "./import.js", "./merchant.js", "./studio.js", "./flow.js", "./refs.js", "./plan.js", "./lpfit.js",
  "./icon.svg", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* 같은 사이트 파일만: 네트워크 우선(최신 반영), 실패하면 저장본 */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("./index.html"); });
    })
  );
});
