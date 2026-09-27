/** public/sw.js の IMAGE_CACHE_NAME と揃えること。 */
export const IMAGE_CACHE_NAME = 'nagisa-img-v1'

export const registerImageCacheWorker = () => {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくても画像は HTTP キャッシュで表示できるので黙って続ける
    })
  })
}

/**
 * 画像キャッシュの合計バイト数。Content-Length が無いレスポンスだけ本体を読んで数える。
 * Cache Storage が使えない環境では null。
 */
export const measureImageCache = async (): Promise<number | null> => {
  if (typeof caches === 'undefined') return null
  if (!(await caches.has(IMAGE_CACHE_NAME))) return 0
  const cache = await caches.open(IMAGE_CACHE_NAME)
  const requests = await cache.keys()
  const sizes = await Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request)
      if (!response) return 0
      const length = Number(response.headers.get('Content-Length'))
      if (Number.isFinite(length) && length > 0) return length
      return (await response.blob()).size
    })
  )
  return sizes.reduce((sum, size) => sum + size, 0)
}

export const clearImageCache = () => caches.delete(IMAGE_CACHE_NAME)
