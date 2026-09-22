import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { cache } from 'hono/cache'
import { optimizeImage } from 'wasm-image-optimization/workerd'
import { PERSISTED_WIDTHS, webpKey } from '../lib/image-key'
import { getAppLogger } from '../lib/logger'
import { ImageProxyParamsSchema, ImageProxyQuerySchema } from '../schemas/img.dto'

type Bindings = { IMAGES: R2Bucket }

const logger = getAppLogger('routes')

const app = new OpenAPIHono<{ Bindings: Bindings }>()

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

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

/** WebP に焼く。原寸より大きい幅を要求された場合は幅指定なしで焼き直す。 */
async function toWebp(image: ArrayBuffer, width?: number) {
  const result = await optimizeImage({ image, format: 'webp', width, quality: 80 })
  // 原寸より大きい幅を渡すと縮小されずに拡大される (実測で確認。全標本の 1/4〜1/3 が
  // 1280px 未満なので珍しい話ではない)。引き伸ばしても情報は増えず、バイト数と
  // 変換時間だけ増えるので、原寸のまま焼き直す。R2 のキーは要求幅のままでよい。
  if (width !== undefined && result.originalWidth < width) {
    return optimizeImage({ image, format: 'webp', quality: 80 })
  }
  return result
}

/**
 * ラダー全段を R2 に置く。
 *
 * 要求された 1 幅だけを置くと、その後オリジンが 404 になった時点で未生成の段を
 * 二度と作れなくなる。元バイナリは R2 に持たない方針 (docs/features/image-persistence-r2-plan.md
 * の P6) なので、miss を掴んだこの 1 回で全段を焼き切っておく必要がある。
 *
 * 逐次に回すのは、同時接続 6 本の枠と isolate の 128 MB を 1 リクエストで食い潰さないため。
 * 1 段の失敗で残りを諦めない。
 */
async function persistLadder(
  bucket: R2Bucket | undefined,
  url: string,
  image: ArrayBuffer,
  requestedWidth: number | undefined,
  converted: ArrayBuffer
): Promise<void> {
  if (!bucket) return
  for (const width of PERSISTED_WIDTHS) {
    // 応答用に焼いた分はそのまま使い回す (ラダー外の幅で来た場合は一致しない)
    if (width === requestedWidth) {
      await putObject(bucket, webpKey(url, width), converted, 'image/webp')
      continue
    }
    try {
      const result = await toWebp(image, width)
      await putObject(bucket, webpKey(url, width), result.data.buffer as ArrayBuffer, 'image/webp')
    } catch (e) {
      logger.warn({ action: 'img-ladder-optimize-failed', url, width, error: message(e) })
    }
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

    // 2. オリジンから取得する。元バイナリは R2 に置かない。アーカイブはローカル
    //    (.cache/originals/) が正で、R2 の原寸は劣化した二重の保険にしかならない
    //    (docs/features/image-persistence-r2-plan.md の P6)。
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

    const image = await res.arrayBuffer()

    let result: Awaited<ReturnType<typeof optimizeImage>>
    try {
      result = await toWebp(image, width)
    } catch (e) {
      logger.error({ action: 'img-optimize-failed', url, width, bytes: image.byteLength, error: message(e) })
      return c.text('Optimization failed', 500)
    }

    const data = result.data.buffer as ArrayBuffer

    // 3. ラダー全段を焼いて永続化する。要求がラダー外の幅でも各段は作っておく
    //    (返す内容は変わらない)。
    c.executionCtx.waitUntil(persistLadder(bucket, url, image, width, data))

    return new Response(data, {
      headers: {
        'content-type': 'image/webp',
        'cache-control': CACHE_CONTROL
      }
    })
  }
)

export default app
