/**
 * fetch のリトライ / 並列制御ヘルパー。
 * AniList や ABEMA 系の外部 API 呼び出しに共通で使う。
 */
import { logger } from './logger'

/** 外部 API 呼び出しのリトライ最大回数のデフォルト。 */
export const DEFAULT_MAX_RETRIES = 4

/** リトライ待機時間の絶対上限 (秒)。 */
export const RETRY_BACKOFF_CEILING_SEC = 60

/** リトライすべき HTTP ステータスかどうかを判定する。429 と 5xx を対象にする。 */
function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

/** 指定秒数だけ待機する。 */
function sleep(sec: number): Promise<void> {
  return new Promise((r) => setTimeout(r, sec * 1000))
}

/**
 * abort / timeout 由来の error かどうか。
 * 呼び出し側が `AbortSignal.timeout` で締め切りを設けている場合、これをリトライすると
 * 締め切りが効かなくなる (signal は abort 済みなので即座に失敗し、待機だけが積み上がる)。
 */
function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
}

/**
 * attempt 回目のリトライ待機秒数を計算する。
 * Retry-After ヘッダ (秒) が正の有限値なら優先し、それ以外は 2^attempt の指数バックオフ。
 * いずれも {@link RETRY_BACKOFF_CEILING_SEC} で頭打ちにする。
 */
function backoffSec(attempt: number, retryAfterHeader?: string | null): number {
  const retryAfter = Number(retryAfterHeader)
  const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt
  return Math.min(backoff, RETRY_BACKOFF_CEILING_SEC)
}

/**
 * fetch を実行しつつ、429 / 5xx / ネットワークエラーで指数バックオフリトライする。
 * Retry-After (秒) が返ってきた場合はそれを優先する。上限は {@link RETRY_BACKOFF_CEILING_SEC}。
 *
 * @param url   fetch する URL
 * @param init  fetch オプション
 * @param maxRetries  リトライ最大回数 (デフォルト {@link DEFAULT_MAX_RETRIES})
 * @returns 最終的な Response。リトライ後も 4xx/5xx が続く場合はそのまま返す。
 * @throws  最後の attempt でもネットワークエラーが起きた場合はその error を再 throw する。
 *          `init.signal` の abort / timeout はリトライせず即座に再 throw する。
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init)
      if (attempt === maxRetries || !isRetriableStatus(res.status)) return res

      const waitSec = backoffSec(attempt, res.headers.get('Retry-After'))
      logger.warn({
        action: 'fetch-retry',
        url,
        status: res.status,
        attempt: attempt + 1,
        maxRetries,
        waitSec
      })
      // 捨てるレスポンスの本文は待機前に閉じる (待機中に接続を握り続けない)
      await res.body?.cancel().catch(() => {})
      await sleep(waitSec)
    } catch (e) {
      // 締め切り超過はリトライしても意味がない。そのまま呼び出し側に返す。
      if (isAbortError(e) || attempt === maxRetries) throw e
      const waitSec = backoffSec(attempt)
      logger.warn({
        action: 'fetch-retry-network',
        url,
        error: e instanceof Error ? e.message : String(e),
        attempt: attempt + 1,
        maxRetries,
        waitSec
      })
      await sleep(waitSec)
    }
  }
  // 到達しない (ループ内で return / throw する) が、TypeScript の網羅性のために置く
  throw new Error('fetchWithRetry: unreachable')
}

/**
 * items を limit 並列で fn に投げ、順序を保った結果配列を返す。
 * chunk 単位で await するので、chunk 内で最遅の promise が全体を律速する。
 *
 * @param items  処理対象のリスト
 * @param limit  同時実行の上限
 * @param fn     各要素を非同期処理するコールバック (要素と index を受け取る)
 * @returns items と同じ順序の結果配列
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  for (let i = 0; i < items.length; i += limit) {
    const chunkIndices = Array.from({ length: Math.min(limit, items.length - i) }, (_, k) => i + k)
    const chunk = await Promise.all(chunkIndices.map((idx) => fn(items[idx], idx)))
    for (let j = 0; j < chunk.length; j++) {
      results[chunkIndices[j]] = chunk[j]
    }
  }
  return results
}
