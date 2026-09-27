/*
 * ポスター画像 (/api/img/*) だけを Cache Storage に置く Service Worker。
 * HTTP キャッシュは中身も容量もページから見えないので、設定画面で容量表示・削除できるよう
 * 名前付きキャッシュに明示的に溜める。キャッシュ名は
 * src/app/lib/image-cache.ts の IMAGE_CACHE_NAME と揃えること。
 */
const IMAGE_CACHE_NAME = 'nagisa-img-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 世代を上げたときに古い画像キャッシュを残さない
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key.startsWith('nagisa-img-') && key !== IMAGE_CACHE_NAME).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/img/')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(IMAGE_CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      // 画像プロキシは immutable なので、取れたものはそのまま使い続けてよい
      if (response.ok) event.waitUntil(cache.put(request, response.clone()))
      return response
    })()
  )
})
