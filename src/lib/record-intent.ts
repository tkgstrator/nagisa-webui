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

/**
 * 1 リクエストで面倒を見るジョブ数の上限。
 *
 * **クエリ数はエピソード数ではなくジョブ数で決まる**。1 話だけのジョブを 600 本
 * 積まれると、行数は 600 でも読み 600 文 + 書き 600 文 = 1200 文になり、
 * エピソード側の上限 (900 行) は一度も効かないまま D1 の
 * **queries per invocation (1000)** を超える。読み 1 文 + 書き 1 文/ジョブが
 * 最悪なので、ここを 200 に抑えておけば 400 文で収まる。
 */
const MAX_JOBS_PER_REQUEST = 200

/**
 * 1 ジョブぶんの読み出し行数の上限。
 *
 * 作品 1 本のエピソードを全部メモリに載せる経路なので、際限なく読むと
 * isolate の 128MB (同時リクエストで共有) を削る。実在の作品でこれを超えることは
 * 無い想定だが、上限として置いておく。
 *
 * **話数の絞り込みはこの後** (メモリ上) なので、ここで切れると指定話が
 * 読み出しの外に落ちて「該当なし」に化けうる。切れたことは黙って捨てず
 * `truncated` として返す。
 */
const MAX_ROWS_PER_JOB = 2000

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
  /** 既に `completed` だったので触らなかったエピソード数 */
  preserved: number
  /** 読み出し上限に達し、対象を全部見られなかったジョブ数 */
  truncated: number
}

/**
 * 投入結果 (nagisa が受理したジョブそのもの) を見て pending を書く。throw しない。
 *
 * 対象の決め方は `data.seasons` に従う。`null` は作品全体、シーズンの
 * `episodes` が `null` ならそのシーズン全体。**リクエストではなくレスポンスを
 * 見る**のは、nagisa が正規化した後の指示内容がこちらだから。
 */
export async function markPending(prisma: Prisma, jobs: Job[]): Promise<RecordIntentResult> {
  const result: RecordIntentResult = { marked: 0, unmatched: 0, dropped: 0, preserved: 0, truncated: 0 }

  try {
    // エピソード → 最後に指示したジョブ。**id で潰してから数える**こと:
    // 同じエピソードを含むジョブが 2 本来たとき、行数で数えると同じ行を
    // 二重に予算から引いてしまい、後続の (重なっていない) ジョブが丸ごと
    // 控えられなくなる。値を後勝ちにするのは「最後の指示が正」だから。
    const owner = new Map<string, string>()
    let skippedJobs = 0

    for (const [index, job] of jobs.entries()) {
      if (index >= MAX_JOBS_PER_REQUEST) {
        skippedJobs = jobs.length - index
        break
      }

      const { provider, content_id, seasons } = job.data

      // シーズン番号だけは D1 側で絞る。作品 1 本ぶんを読んでから捨てるより
      // 安いし、パラメータもシーズン数ぶんしか食わない。話数の絞り込みまで
      // 持っていくと (season_number, episode_number) の組が bound parameter
      // (100) を食い潰すので、そちらはメモリ上に残す。
      const seasonNumbers = seasons ? [...new Set(seasons.map((s) => s.season_number))] : null
      const seasonFilter =
        seasonNumbers !== null && seasonNumbers.length <= IN_CHUNK ? { seasonNumber: { in: seasonNumbers } } : {}

      // 上限 + 1 件読んで「切れたか」を判定する。切れたことを知らずに畳むと、
      // 読み出しの外に落ちた指定話が unmatched (該当なし) に化けて、
      // 録画は走っているのに WebUI からは何も見えない行が残る。
      const rows = await prisma.episode.findMany({
        where: {
          season: { ...seasonFilter, anime: { provider, contentId: content_id } }
        },
        select: { id: true, episodeNumber: true, recordStatus: true, season: { select: { seasonNumber: true } } },
        orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }],
        take: MAX_ROWS_PER_JOB + 1
      })

      let rowsTruncated = false
      if (rows.length > MAX_ROWS_PER_JOB) {
        rows.length = MAX_ROWS_PER_JOB
        rowsTruncated = true
        result.truncated++
        logger.warn({
          action: 'record-intent-rows-truncated',
          provider,
          contentId: content_id,
          jobId: job.job_id,
          limit: MAX_ROWS_PER_JOB
        })
      }

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
        // 切り詰めた後の該当なしは「存在しない」ではなく「読み出しの外に落ちた」
        // かもしれない。unmatched に混ぜると調べる先を間違えるので、
        // その回は truncated (上で計上済み) の扱いのままにする。
        if (!rowsTruncated) {
          result.unmatched++
          logger.warn({ action: 'record-intent-unmatched', provider, contentId: content_id, jobId: job.job_id })
        }
        continue
      }

      for (const row of wanted) {
        // 既に実体がある行は触らない。**ここで pending に落とすと録画済みが消える**:
        // nagisa は既存ファイルを飛ばすので台帳に変更イベントが出ず、ジョブは
        // 何もせず終わる。差分同期には `completed` を書き戻す材料が無いまま、
        // 30 分後に job-sync が stale へ落としてしまう。
        if (row.recordStatus === 'completed') {
          result.preserved++
          continue
        }
        if (!owner.has(row.id) && owner.size >= MAX_PENDING_PER_REQUEST) {
          result.dropped++
          continue
        }
        owner.set(row.id, job.job_id)
      }
    }

    if (skippedJobs > 0) {
      logger.warn({ action: 'record-intent-jobs-truncated', skipped: skippedJobs, limit: MAX_JOBS_PER_REQUEST })
    }
    if (result.dropped > 0) {
      logger.warn({ action: 'record-intent-truncated', dropped: result.dropped, limit: MAX_PENDING_PER_REQUEST })
    }

    const byJob = new Map<string, string[]>()
    for (const [episodeId, jobId] of owner) {
      const ids = byJob.get(jobId)
      if (ids) ids.push(episodeId)
      else byJob.set(jobId, [episodeId])
    }

    // 猶予の起点なので、読みに何秒かかったかに関わらず**書く直前**の時刻にする。
    // 読み始めの時刻を使うと、重い読みの後に書いた行が生まれた瞬間から
    // 30 分の無音条件に近づいてしまう。
    const now = new Date()
    for (const [jobId, ids] of byJob) {
      for (const part of chunk(ids, IN_CHUNK)) {
        const hit = await prisma.episode.updateMany({
          // 読んだ後・書く前に library-sync が `completed` を書く隙があるので、
          // 除外は読みだけでなく **更新条件にも** 置く。
          where: { id: { in: part }, recordStatus: { not: 'completed' } },
          data: {
            recordStatus: 'pending',
            recordSource: 'queue',
            recordJobId: jobId,
            recordError: null,
            recordSyncedAt: now
          }
        })
        result.marked += hit.count
        result.preserved += part.length - hit.count
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
