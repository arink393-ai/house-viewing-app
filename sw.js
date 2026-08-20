/* 看房紀錄 App — Service Worker
   目的：1) 讓 Android Chrome 出現「安裝應用程式」提示
        2) 沒網路（例如在大樓裡收訊差）也能開啟並填寫紀錄
   注意：看房紀錄本身存在 localStorage，不經過這裡，離線填寫一樣會保存。 */

const CACHE = 'house-viewing-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // 用 cache:'reload' 略過瀏覽器 HTTP 快取，確保存進來的一定是伺服器上的最新版；
      // 逐一處理並容錯，單一檔案失敗不會讓整個安裝失敗。
      Promise.all(ASSETS.map(url =>
        fetch(new Request(url, { cache: 'reload' }))
          .then(res => (res.ok ? c.put(url, res) : null))
          .catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // 網頁本體：優先拿新版（改版後重新整理就會更新），沒網路才用快取
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 圖示等靜態檔：優先用快取，開啟比較快
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
