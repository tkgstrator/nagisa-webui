import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { cache } from 'hono/cache'
import { optimizeImage } from 'wasm-image-optimization/workerd'
import { originalKey, PERSISTED_WIDTHS, webpKey } from '../lib/image-key'
import { getAppLogger } from '../lib/logger'
import { ImageProxyParamsSchema, ImageProxyQuerySchema } from '../schemas/img.dto'

type Bindings = { IMAGES: R2Bucket }

const logger = getAppLogger('routes')

const app = new OpenAPIHono<{ Bindings: Bindings }>()

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * R2 に永続化する幅のホワイトリスト。ラダー (image-key.ts の PERSISTED_WIDTHS) の幅だけを保存し、
 * 任意の ?w= でオブジェクトが際限なく増えるのを防ぐ。範囲外の幅も変換して返す点は変わらない。
 */
const PERSISTED_WIDTH_SET: ReadonlySet<number> = new Set(PERSISTED_WIDTHS)

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** R2 からの取得。バインディング未設定や R2 障害ではリクエストを落とさず miss 扱いにする */
async function getObject(bucket: R2Bucket | undefined, key: string) {
  if (!bucket) return null
  try {
    return await bucket.get(key)
  } catch (e) {
    logger.warn({ action: 'img-r2-get-failed', key, error: message(e) })
    return null
  }
}

/** R2 への保存。waitUntil から呼ぶので、失敗してもログを残すだけで握りつぶす */
async function putObject(bucket: R2Bucket | undefined, key: string, body: ArrayBuffer, contentType: string) {
  if (!bucket) return
  try {
    await bucket.put(key, body, { httpMetadata: { contentType, cacheControl: CACHE_CONTROL } })
  } catch (e) {
    logger.warn({ action: 'img-r2-put-failed', key, error: message(e) })
  }
}

// key は base64url (ProxyImage が `/` を `_` に置換する) なのでスラッシュを含まない。
// 以前の `/:key{.+}` は複数セグメントも拾っていたが、そのような key は atob で落ちるだけだった
app.use('/:key', cache({ cacheName: 'img-proxy', cacheControl: CACHE_CONTROL }))

app.openapi(
  createRoute({
    method: 'get',
    path: '/{key}',
    tags: ['Image'],
    summary: '画像プロキシ (WebP 変換 + R2 永続化)',
    request: {
      params: ImageProxyParamsSchema,
      query: ImageProxyQuerySchema
    },
    responses: {
      200: {
        description: 'WebP 変換済み画像',
        content: { 'image/webp': { schema: z.string() } }
      },
      400: {
        description: 'w が 1〜4096 の整数でない (ProxyImage は常にラダーの値を送るので、出たら呼び出し側のバグ)',
        content: { 'application/json': { schema: z.object({ success: z.literal(false) }) } }
      },
      500: {
        description: 'WebP 変換失敗',
        content: { 'text/plain': { schema: z.string().nonempty() } }
      },
      502: {
        description: 'オリジン取得失敗、または画像以外が返った',
        content: { 'text/plain': { schema: z.string().nonempty() } }
      }
    }
  }),
  async (c) => {
    const { key: raw } = c.req.valid('param')
    const key = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = key + '==='.slice(0, (4 - (key.length % 4)) % 4)
    const url = atob(padded)

    // 範囲 (1〜4096) と整数性は ImageProxyQuerySchema が担保する。範囲外は 400 で落ちる
    const { w: width } = c.req.valid('query')

    const bucket = c.env.IMAGES

    // 1. 変換済み WebP が R2 にあればそのまま返す (オリジンへの fetch も変換も起きない)
    const cached = await getObject(bucket, webpKey(url, width))
    if (cached !== null) {
      return new Response(cached.body, {
        headers: { 'content-type': 'image/webp', 'cache-control': CACHE_CONTROL }
      })
    }

    // 2. 元バイナリが R2 にあれば変換元に使う。無ければオリジンから取得してアーカイブする
    let image: ArrayBuffer
    const archived = await getObject(bucket, originalKey(url))
    if (archived !== null) {
      image = await archived.arrayBuffer()
    } else {
      const res = await fetch(url)
      if (!res.ok) {
        logger.warn({ action: 'img-upstream-error', url, status: res.status })
        return c.text('Upstream error', 502)
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) {
        logger.warn({ action: 'img-not-an-image', url, contentType })
        return c.text('Not an image', 502)
      }

      image = await res.arrayBuffer()
      c.executionCtx.waitUntil(putObject(bucket, originalKey(url), image, contentType))
    }

    let result: Awaited<ReturnType<typeof optimizeImage>>
    try {
      result = await optimizeImage({ image, format: 'webp', width, quality: 80 })
      // 原寸より大きい幅を渡すと縮小されずに拡大される (実測で確認。全標本の 1/4〜1/3 が
      // 1280px 未満なので珍しい話ではない)。引き伸ばしても情報は増えず、バイト数と
      // 変換時間だけ増えるので、原寸のまま焼き直す。R2 のキーは要求幅のままでよい。
      if (width !== undefined && result.originalWidth < width) {
        result = await optimizeImage({ image, format: 'webp', quality: 80 })
      }
    } catch (e) {
      logger.error({ action: 'img-optimize-failed', url, width, bytes: image.byteLength, error: message(e) })
      return c.text('Optimization failed', 500)
    }

    const data = result.data.buffer as ArrayBuffer

    // 3. 変換結果を永続化する (幅なし、またはフロントが実際に使う幅のみ)
    if (width === undefined || PERSISTED_WIDTH_SET.has(width)) {
      c.executionCtx.waitUntil(putObject(bucket, webpKey(url, width), data, 'image/webp'))
    }

    return new Response(data, {
      headers: {
        'content-type': 'image/webp',
        'cache-control': CACHE_CONTROL
      }
    })
  }
)

export default app
