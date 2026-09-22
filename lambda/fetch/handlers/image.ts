/**
 * `/image` ハンドラ。
 *
 * 画像 URL を取得し、フロントが実際に要求する幅 (ラダー) の WebP に焼いて base64 で返す。
 * Crunchyroll の画像は JP IP から geo-block されるので、Worker の `fetch` では取れない。
 * Lambda (US) 経由で取るためのルートで、Worker 側は結果をそのまま R2 に積む。
 *
 * 原本をそのまま返すと 1 枚 0.83 MiB (base64) になるが、ラダー 3 幅なら合計 41.7 KiB で済む
 * (229,140 枚の実測平均)。Function URL の 6 MB 上限に対して 10 件 × 3 幅 ≈ 555 KiB。
 *
 * 変換条件は `scripts/analysis/convert-ladder-native.ts` と同じ。本番の `src/routes/img.ts`
 * (wasm-image-optimization) とはリサイザが違うので出力バイト数は一致しない (実測で約 6% 小さい)。
 * ここでは速度を優先してネイティブ (libvips) を使っている。
 */
import sharp from 'sharp'
import type { z } from 'zod'
import { PERSISTED_WIDTHS } from '../../../src/lib/image-key'
import type { FetchImageResponseSchema } from '../../../src/schemas/lambda.dto'
import { fetchWithRetry, runWithConcurrency } from '../http'
import { logger } from '../logger'

/** `/image` のレスポンス型。`FetchImageResponseSchema` (lambda.dto) から導出する。 */
type FetchImageResponse = z.infer<typeof FetchImageResponseSchema>
type FetchImageResult = FetchImageResponse['results'][number]

/** `src/routes/img.ts` のハードコード値と揃える。 */
const QUALITY = 80

/**
 * 画像取得のリトライ回数。既定 (4) より減らしてある。
 * 複数 URL を並列で走らせるので、1 枚の粘りが batch 全体の実行時間になる。
 */
const MAX_RETRIES = 2

/**
 * 1 枚あたりの取得タイムアウト (リトライ込みの総時間)。
 * これが無いと、応答を返さない 1 枚が batch 全体を Lambda のタイムアウトまで引きずり、
 * 変換に成功した他の画像まで丸ごと失われる。
 */
const FETCH_TIMEOUT_MS = 15_000

/**
 * 同時に原本を抱える枚数。`sharp.concurrency(1)` は libvips 内部のスレッド数であって
 * 取得の並列度ではないので、ここで明示的に絞る。原本 + 変換バッファ + base64 が
 * 同時にメモリに載るのは高々この枚数分になる。
 */
const CONCURRENCY = 4

/** 原本の上限。超える URL は読み切らずに打ち切って諦める。 */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

/**
 * 1 枚あたりの出力 (base64 の合計) 上限。
 * 実測の最大が w800 単体で 60.9 KiB なので 512 KiB は十分な余裕がある。
 * 10 枚全部がこれに張り付いても 5 MiB で、Function URL の 6 MB 上限に収まる。
 */
const MAX_RESULT_BASE64_BYTES = 512 * 1024

// 並列は URL 単位で出すので libvips 自身のスレッドプールは切る。二重に並列化すると
// 1 枚あたりのスレッド取り合いで却って遅くなる (convert-ladder-native.ts の実測)。
sharp.concurrency(1)
sharp.cache(false)

/**
 * base64 化。
 *
 * `sharp` が返す `Buffer<ArrayBuffer>` に対して直接 `toString('base64')` を呼ぶと
 * `TS2554: Expected 0 arguments, but got 1` になる。typescript 7 + @types/node 26 では
 * `Buffer` の宣言マージ (buffer.d.ts の非ジェネリック版が持つ Node 固有メソッド +
 * buffer.buffer.d.ts のジェネリック版) が成立せず、型からエンコーディング引数付きの
 * `toString` が落ちているため。`Buffer.from(buffer, offset, length)` はビューを作るだけで
 * コピーしないので、迂回の実行時コストはない。
 */
function toBase64(data: Uint8Array): string {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64')
}

/** 使わないレスポンスの本文を明示的に捨てる。放置すると接続と受信バッファが残る。 */
async function discard(res: Response): Promise<void> {
  try {
    await res.body?.cancel()
  } catch {
    // 既に閉じられている場合は何もしなくてよい
  }
}

/**
 * 本文を上限付きで読む。`content-length` があればまずそれで弾き、無い / 嘘の場合も
 * 読みながら積算して超えた時点で打ち切る。上限超過は `null` を返す。
 */
async function readBounded(res: Response, limit: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit) {
    await discard(res)
    return null
  }

  const reader = res.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** 1 枚を取得してラダー各幅に焼く。失敗は throw せず error 文字列で返す。 */
async function convertOne(url: string): Promise<FetchImageResult> {
  try {
    // 取得先は画像 CDN に限られる。http や他スキームを Lambda から叩かせない。
    if (!URL.parse(url)?.protocol.startsWith('https')) {
      return { url, widths: null, error: 'unsupported protocol' }
    }

    const res = await fetchWithRetry(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }, MAX_RETRIES)
    if (!res.ok) {
      await discard(res)
      return { url, widths: null, error: `HTTP ${res.status}` }
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      await discard(res)
      return { url, widths: null, error: `unexpected content-type: ${contentType || '(none)'}` }
    }

    if (res.body === null) return { url, widths: null, error: 'empty body' }

    const source = await readBounded(res, MAX_SOURCE_BYTES)
    if (source === null) return { url, widths: null, error: `source exceeds ${MAX_SOURCE_BYTES} bytes` }

    const widths: Record<string, string> = {}
    let encoded = 0
    for (const width of PERSISTED_WIDTHS) {
      // withoutEnlargement: 原寸より大きい幅を要求しても拡大しない (img.ts の頭打ちと同じ挙動)
      const data = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      encoded += Math.ceil(data.byteLength / 3) * 4
      // 1 枚で使い切ると batch 全体が 6 MB 上限に当たって全滅するので、その前に諦める
      if (encoded > MAX_RESULT_BASE64_BYTES) {
        return { url, widths: null, error: `output exceeds ${MAX_RESULT_BASE64_BYTES} bytes` }
      }
      widths[String(width)] = toBase64(data)
    }
    return { url, widths }
  } catch (e) {
    return { url, widths: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 複数の画像 URL を取得して WebP のラダーに変換する。
 *
 * 1 枚の失敗で batch 全体を落とさない。取れなかった URL は `widths: null` + `error` で返り、
 * 呼び出し側 (`src/lib/image-warm.ts`) はその URL だけ諦めて残りを R2 に積む。
 *
 * @param urls  取得する画像 URL (最大 10 件。スキーマ側で制限)
 * @returns 入力順の results
 */
export async function fetchImages(urls: string[]): Promise<FetchImageResponse> {
  const results = await runWithConcurrency(urls, CONCURRENCY, convertOne)

  const ok = results.filter((r) => r.widths !== null).length
  const bytes = results.reduce(
    (sum, r) => sum + Object.values(r.widths ?? {}).reduce((s, b64) => s + b64.length, 0),
    0
  )
  logger.info({ action: 'fetch-images', total: urls.length, ok, ng: urls.length - ok, base64Bytes: bytes })

  return { results }
}
