/**
 * 新規エピソードの画像を R2 に事前 warm する。
 *
 * Crunchyroll の画像は JP IP (Workers の東京 colo) からは geo-block されるので、
 * `src/routes/img.ts` のリクエスト時 fetch では取得できず 502 になる。
 * sync で新しい `imageUrl` を掴んだ時点で US Lambda に取りに行かせ、
 * WebP のラダー各幅を R2 に置いておくことで、リクエスト時は R2 ヒットだけで済ませる。
 *
 * 1 呼び出し = 1 queue message = 高々 10 URL = Lambda 1 往復 (`image_warm` message、
 * 送信元は `src/queue.ts`)。失敗時に queue の retry を効かせたいので、Lambda 呼び出し・
 * R2 put の失敗はここでは握り潰さず呼び出し元に throw する。
 */
import type { z } from 'zod'
import type { Message, ProviderTypeEnum } from '../schemas/message.dto'
import { PERSISTED_WIDTHS, webpKey } from './image-key'
import type { FetchClient } from './lambda'
import { getAppLogger } from './logger'

const logger = getAppLogger('image-warm')

/** 1 image_warm message に載せる URL 数。`FetchImageRequestSchema` の上限 (10) と揃える。 */
const WARM_CHUNK_SIZE = 10

/** 新規画像 URL を重複除去し、WARM_CHUNK_SIZE 件ずつ image_warm message として queue に送る */
export async function enqueueImageWarm(
  queue: Queue<Message>,
  provider: z.infer<typeof ProviderTypeEnum>,
  urls: string[]
): Promise<void> {
  const unique = [...new Set(urls.filter((url) => url.length > 0))]
  for (let i = 0; i < unique.length; i += WARM_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + WARM_CHUNK_SIZE)
    await queue.send({ type: 'image_warm', message: { provider, urls: chunk } })
  }
}

/** R2 に置く WebP の Cache-Control。`src/routes/img.ts` と揃える。 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * head() を同時に投げる本数。
 *
 * Workers は「レスポンスヘッダ待ちの接続」を同時 6 本までしか持てない (R2 の head/put も
 * 同じ枠を消費する)。1 message 最大 10 URL に収まっているが、10 本一斉に投げると枠を
 * 超えるので、5 本ずつに区切って投げる。
 */
const HEAD_CONCURRENCY = 5

/** base64 → ArrayBuffer。Workers には Buffer が無いので atob で開く。 */
function decodeBase64(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** 各 URL について、最大幅 (marker) が R2 に既に存在するかを HEAD_CONCURRENCY 本ずつ区切って調べる */
async function headExisting(bucket: R2Bucket, urls: string[], marker: number): Promise<boolean[]> {
  const exists: boolean[] = new Array(urls.length)
  for (let i = 0; i < urls.length; i += HEAD_CONCURRENCY) {
    const chunk = urls.slice(i, i + HEAD_CONCURRENCY)
    const heads = await Promise.all(chunk.map((url) => bucket.head(webpKey(url, marker))))
    for (let j = 0; j < heads.length; j++) exists[i + j] = heads[j] !== null
  }
  return exists
}

/**
 * 画像 URL 群 (高々 10 件) を Lambda 経由で取得し、WebP のラダー各幅を R2 に置く。
 *
 * @param bucket   R2 (`IMAGES` binding)
 * @param lambda   Lambda fetch クライアント。provider で JP/US を振り分ける
 * @param provider 取得元 provider ('crunchyroll' なら US Lambda になる)
 * @param urls     warm 対象の画像 URL (重複・空文字を含んでよい)
 */
export async function warmImages(
  bucket: R2Bucket,
  lambda: FetchClient,
  provider: string,
  urls: string[]
): Promise<void> {
  const unique = [...new Set(urls.filter((url) => url.length > 0))]
  if (unique.length === 0) return

  // 最後に put する幅の存在を「全幅が揃っている」印として使う (下の put は昇順・逐次)
  const marker = PERSISTED_WIDTHS[PERSISTED_WIDTHS.length - 1]
  const exists = await headExisting(bucket, unique, marker)
  const targets = unique.filter((_, i) => !exists[i])

  logger.info({ action: 'image-warm-start', provider, total: unique.length, targets: targets.length })
  if (targets.length === 0) return

  const { results } = await lambda.fetchImage({ provider, urls: targets })

  let stored = 0
  let skipped = 0
  for (const result of results) {
    if (result.widths === null) {
      skipped += 1
      logger.warn({ action: 'image-warm-skip', url: result.url, error: result.error ?? 'unknown' })
      continue
    }
    // 幅の昇順で逐次に put する。途中で落ちても marker (最大幅) は書かれないので、
    // 次回の warm で同じ URL が再び対象に戻る。
    const entries = Object.entries(result.widths).sort((a, b) => Number(a[0]) - Number(b[0]))
    for (const [width, b64] of entries) {
      await bucket.put(webpKey(result.url, Number(width)), decodeBase64(b64), {
        httpMetadata: { contentType: 'image/webp', cacheControl: CACHE_CONTROL }
      })
    }
    stored += 1
  }

  logger.info({ action: 'image-warm-done', provider, stored, skipped })
}
