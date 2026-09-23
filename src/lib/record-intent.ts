/**
 * 録画指示を出した直後に、対象エピソードへ `pending` と job id を控える。
 *
 * ここが同期の入口。**`recordJobId` と `recordSyncedAt` を必ず同時に書く**こと:
 *   - job id が無い行はキューの snapshot と突き合わせようがなく、job-sync から
 *     見えない (追跡対象の抽出条件が `recordJobId: { not: null }`)。
 *   - `recordSyncedAt` が無い行は猶予を測れず、`lt` 比較が NULL を拾わないので
 *     **永久に stale にならない**。指示が宙に浮いたまま誰も気付けなくなる。
 *
 * 書けるのは `pending` まで。`downloading` はキューで active を見た job-sync が、
 * `completed` は実体を見た台帳同期 (library-sync) だけが書く。
 */

import type { NagisaQueueResponseJobSchema } from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'

const logger = getAppLogger('record-intent')

type Prisma = ReturnType<typeof createPrismaClient>
type Job = import('zod').infer<typeof NagisaQueueResponseJobSchema>

/** `IN (...)` を D1 の bound parameter 上限 (100) に収めるための分割幅。 */
const IN_CHUNK = 90

/**
 * 1 リクエストで pending にするエピソード数の上限。
 *
 * 投入は人の操作なので件数は指示次第だが、作品 1 本を丸ごと (シーズン指定なし)
 * 何本も積まれると D1 の **queries per invocation (1000)** に届きうる。
 * 上限を超えたぶんは控えない — その行は job id を持たないので追跡対象から外れ、
 * 実体が出来たときに台帳同期が `completed` で拾う (録画自体は止めない)。
 */
const MAX_PENDING_PER_REQUEST = 900

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export interface RecordIntentResult {
  /** pending を書けたエピソード数 */
  marked: number
  /** 指示は通ったがローカルに該当エピソードが無かったジョブ数 */
  unmatched: number
  /** 上限で控えきれなかったエピソード数 */
  dropped: number
}

/**
 * 投入結果 (nagisa が受理したジョブそのもの) を見て pending を書く。throw しない。
 *
 * 対象の決め方は `data.seasons` に従う。`null` は作品全体、シーズンの
 * `episodes` が `null` ならそのシーズン全体。**リクエストではなくレスポンスを
 * 見る**のは、nagisa が正規化した後の指示内容がこちらだから。
 */
export async function markPending(prisma: Prisma, jobs: Job[]): Promise<RecordIntentResult> {
  const result: RecordIntentResult = { marked: 0, unmatched: 0, dropped: 0 }
  const now = new Date()

  try {
    // job id ごとに対象エピソードを束ねる。同じエピソードが複数のジョブに現れる
    // ことは無い前提だが、来たら後のジョブで上書きされる (最後の指示が正)。
    const byJob: { jobId: string; ids: string[] }[] = []
    let budget = MAX_PENDING_PER_REQUEST

    for (const job of jobs) {
      const { provider, content_id, seasons } = job.data
      const rows = await prisma.episode.findMany({
        where: { season: { anime: { provider, contentId: content_id } } },
        select: { id: true, episodeNumber: true, season: { select: { seasonNumber: true } } }
      })

      // シーズン指定の絞り込みはメモリ上で行う。D1 側に条件を組むと
      // (season_number, episode_number) の組が bound parameter を食い潰す。
      const wanted = seasons
        ? rows.filter((r) =>
            seasons.some(
              (s) =>
                s.season_number === r.season.seasonNumber &&
                (s.episodes === null || s.episodes.includes(r.episodeNumber))
            )
          )
        : rows

      if (wanted.length === 0) {
        result.unmatched++
        logger.warn({ action: 'record-intent-unmatched', provider, contentId: content_id, jobId: job.job_id })
        continue
      }

      const ids = wanted.slice(0, Math.max(budget, 0)).map((r) => r.id)
      result.dropped += wanted.length - ids.length
      budget -= ids.length
      if (ids.length > 0) byJob.push({ jobId: job.job_id, ids })
    }

    if (result.dropped > 0) {
      logger.warn({ action: 'record-intent-truncated', dropped: result.dropped, limit: MAX_PENDING_PER_REQUEST })
    }

    for (const { jobId, ids } of byJob) {
      for (const part of chunk(ids, IN_CHUNK)) {
        const hit = await prisma.episode.updateMany({
          where: { id: { in: part } },
          data: {
            recordStatus: 'pending',
            recordSource: 'queue',
            recordJobId: jobId,
            recordError: null,
            recordSyncedAt: now
          }
        })
        result.marked += hit.count
      }
    }

    logger.info({ action: 'record-intent-done', jobs: jobs.length, marked: result.marked })
    return result
  } catch (e) {
    // 指示そのものは既に nagisa に通っている。控えに失敗しても投入を巻き戻せない
    // ので、記録だけ残して 200 を返す (実体が出来れば台帳同期が拾う)。
    logger.error({ action: 'record-intent-error', error: e instanceof Error ? e.message : String(e) })
    return result
  }
}
