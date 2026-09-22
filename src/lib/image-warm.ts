/**
 * 新規エピソードの画像を R2 に事前 warm する。
 *
 * Crunchyroll の画像は JP IP (Workers の東京 colo) からは geo-block されるので、
 * `src/routes/img.ts` のリクエスト時 fetch では取得できず 502 になる。
 * sync で新しい `imageUrl` を掴んだ時点で US Lambda に取りに行かせ、
 * WebP のラダー各幅を R2 に置いておくことで、リクエスト時は R2 ヒットだけで済ませる。
 *
 * warm の失敗は sync の失敗にしない。呼び出し時点で D1 の書き込みは確定済みなので、
 * ここで throw すると queue message が再配信されて sync 全体がやり直しになる。
 */
import { PERSISTED_WIDTHS, webpKey } from './image-key'
import type { FetchClient } from './lambda'
import { getAppLogger } from './logger'

const logger = getAppLogger('image-warm')

/** R2 に置く WebP の Cache-Control。`src/routes/img.ts` と揃える。 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** 1 回の Lambda 呼び出しに載せる URL 数。`FetchImageRequestSchema` の上限と揃える。 */
const BATCH_SIZE = 10

/**
 * 1 回の sync で warm する枚数の上限。
 * 新規シーズンの初回 sync では 1 話ずつではなく全話分の URL が一度に積まれるので、
 * 上限が無いと Lambda 往復が数十回続き、queue message の可視性タイムアウトに当たる。
 * 溢れた分は次の sync で (R2 に無いので) 再び候補に上がる。
 */
const MAX_WARM_PER_SYNC = 120

/**
 * batch を続けるかどうかの時間予算。1 batch (10 枚) は実測で数秒なので、
 * 超過は上流が詰まっているサイン。打ち切って sync を先に進める。
 */
const TIME_BUDGET_MS = 60_000

/**
 * 同時に走らせる Lambda 往復の本数。
 *
 * Workers は「レスポンスヘッダ待ちの接続」を同時 6 本までしか持てず、7 本目は
 * 枠が空くまで queue される。R2 の head / put も同じ枠を消費するので、6 を超えて
 * 広げても待ち時間は縮まらず、同時に抱える base64 のピークだけが増える。
 *
 * 1 batch の戻りは最悪 10 × 512 KiB = 5 MiB (Lambda 側の MAX_RESULT_BASE64_BYTES)
 * なので 6 本で 30 MiB。isolate の 128 MiB は複数リクエストで共有するため、
 * これ以上積むと Error 1102 (Exceeded Memory) の危険が出る。
 */
const BATCH_CONCURRENCY = 6

/** base64 → ArrayBuffer。Workers には Buffer が無いので atob で開く。 */
function decodeBase64(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * 画像 URL 群を Lambda 経由で取得し、WebP のラダー各幅を R2 に置く。
 *
 * 例外は投げない。失敗は warn ログに残して戻る。
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

  try {
    // 最後に put する幅の存在を「全幅が揃っている」印として使う (下の put は昇順・逐次)
    const marker = PERSISTED_WIDTHS[PERSISTED_WIDTHS.length - 1]
    const heads = await Promise.all(unique.map((url) => bucket.head(webpKey(url, marker))))
    const pending = unique.filter((_, i) => heads[i] === null)
    const targets = pending.slice(0, MAX_WARM_PER_SYNC)

    logger.info({
      action: 'image-warm-start',
      provider,
      total: unique.length,
      todo: pending.length,
      targets: targets.length
    })
    if (targets.length === 0) return

    const deadline = Date.now() + TIME_BUDGET_MS
    const batches: string[][] = []
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      batches.push(targets.slice(i, i + BATCH_SIZE))
    }

    let stored = 0
    let failed = 0
    let skipped = pending.length - targets.length
    let nextBatch = 0
    let budgetExceeded = false

    /**
     * batch を 1 つ取って Lambda に投げ、戻りをそのまま R2 に置く、を無くなるまで繰り返す。
     * これを BATCH_CONCURRENCY 本だけ並べる。
     *
     * 波 (Promise.all で 6 本ずつ区切る) にしないのは、遅い 1 本が他の枠を空のまま
     * 待たせてしまうため。Lambda 側は 1 枚 15 秒まで粘るので batch 間の差が大きい。
     */
    const consume = async (): Promise<void> => {
      while (true) {
        const batch = batches[nextBatch++]
        if (batch === undefined) return

        if (Date.now() > deadline) {
          budgetExceeded = true
          skipped += batch.length
          continue
        }

        // 失敗は batch 単位で握り潰す。ここで throw すると Promise.all が即 reject し、
        // 他の 5 本が put の途中のまま放置される (queue consumer では完了が保証されない)。
        let results: Awaited<ReturnType<typeof lambda.fetchImage>>['results']
        try {
          results = (await lambda.fetchImage({ provider, urls: batch })).results
        } catch (e) {
          failed += batch.length
          logger.warn({
            action: 'image-warm-batch-failed',
            provider,
            count: batch.length,
            error: e instanceof Error ? e.message : String(e)
          })
          continue
        }

        for (const result of results) {
          if (result.widths === null) {
            failed += 1
            logger.warn({ action: 'image-warm-skip', url: result.url, error: result.error ?? 'unknown' })
            continue
          }
          // 幅の昇順で逐次に put する。途中で落ちても marker (最大幅) は書かれないので、
          // 次の sync で同じ URL が再び warm 対象に戻る。並列にすると marker だけ先に
          // 着地して、欠けた幅が永久に埋まらなくなる。
          // (この逐次性は URL ごとの不変条件なので、batch を並列にしても壊れない)
          const entries = Object.entries(result.widths).sort((a, b) => Number(a[0]) - Number(b[0]))
          for (const [width, b64] of entries) {
            await bucket.put(webpKey(result.url, Number(width)), decodeBase64(b64), {
              httpMetadata: { contentType: 'image/webp', cacheControl: CACHE_CONTROL }
            })
          }
          stored += 1
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, batches.length) }, consume))

    if (budgetExceeded) {
      logger.warn({ action: 'image-warm-budget-exceeded', provider, skipped })
    }
    logger.info({ action: 'image-warm-done', provider, stored, failed, skipped })
  } catch (e) {
    // sync 本体は成功しているので、ここでは記録だけして戻る
    logger.warn({
      action: 'image-warm-failed',
      provider,
      count: unique.length,
      error: e instanceof Error ? e.message : String(e)
    })
  }
}
