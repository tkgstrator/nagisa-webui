/**
 * nagisa のキュー (GET /api/queue/snapshot) を見て、録画指示したエピソードの
 * 途中経過を追う。設計は docs/features/recording-sync.md §6。
 *
 * ここで書けるのは `downloading` / `failed` / `stale` の 3 つだけ。
 * **`completed` は絶対に書かない**: ジョブがキューから消えたことは成功を意味せず、
 * スキップ・途中失敗・ワーカー再起動と区別できない。実体の有無を言えるのは
 * 台帳 (library-sync.ts) だけ。
 *
 * nagisa が落ちている・タイムアウトしたときも **1 行も書かない**。
 * 「応答が空」と「キューが空」を取り違えると、走っている録画が軒並み
 * `stale` に落ちる。
 */

import { NagisaQueueSnapshotSchema } from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'
import { fetchNagisaRaw, NagisaConfigError, type NagisaEnv } from './nagisa-client'

const logger = getAppLogger('job-sync')

type Prisma = ReturnType<typeof createPrismaClient>

/** キューのどこにも居ないジョブを見限るまでの猶予。 */
const STALE_AFTER_MS = 30 * 60_000
/** failedReason は D1 に丸ごと入れない (スタックトレースが来ることがある)。 */
const ERROR_MAX = 500

/** この経路が触りうる状態。completed / missing / none は対象外。 */
const IN_FLIGHT = ['pending', 'downloading'] as const
/**
 * `IN (...)` に並べる job id の上限。D1 の **bound parameters per query = 100**
 * に収めるための分割幅。キューに数百件積まれている状態で job id をそのまま
 * 並べると実行時に落ちる。
 */
const IN_CHUNK = 90
/**
 * 1 tick で failed に落とす件数の上限。理由が 1 件ずつ違うので updateMany を
 * まとめられず、そのままだと D1 の **queries per invocation (1000)** に当たる。
 */
const MAX_FAILED_PER_RUN = 100
/**
 * 1 tick で面倒を見る追跡中ジョブの上限。
 *
 * クエリ数の見積りはこの数で決まる: heartbeat が `ceil(N/90)`、
 * pending→downloading と stale がそれぞれ同じく `ceil(N/90)`、failed が最大 100。
 * N=900 なら 10 + 10 + 10 + 100 ≒ 130 文で、D1 の 1000 に十分収まる
 * (起点の無い行への埋め戻しが最悪 +10。通常は 0 文)。
 *
 * **キューの件数ではなくローカルの件数で測る**ことが肝心。nagisa 側に失敗が
 * 数万件積まれていても、こちらが追跡している行が 1 件ならクエリも 1 件で済む。
 */
const MAX_TRACKED = 900

/** `IN (...)` を D1 の bound parameter 上限に収めるために分ける。 */
function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

export interface JobSyncResult {
  /** 追跡中のジョブが無く、nagisa を叩かなかった */
  skipped: boolean
  downloading: number
  failed: number
  stale: number
  error: string | null
}

const emptyResult = (): JobSyncResult => ({ skipped: false, downloading: 0, failed: 0, stale: 0, error: null })

/**
 * 進行中の録画指示をキューの状態に合わせて更新する。throw しない。
 */
export async function syncJobs(prisma: Prisma, env: Partial<NagisaEnv>): Promise<JobSyncResult> {
  const result = emptyResult()

  try {
    // **先にローカルの追跡対象を引く**。以降の処理はこの集合との交差だけを見る。
    // キュー側の件数で回すと、nagisa に失敗が数万件積まれている状態で
    // heartbeat も tracked 検索も数百文に膨らみ、failed を適用する前に D1 の
    // **queries per invocation (1000)** を超えて同期ごと落ちる。
    //
    // job id を控えていない行 (指示が nagisa に届く前に落ちた等) は交差のしようが
    // 無いので最初から外す。distinct は SQLite ではメモリ上の後処理なので使わず、
    // 重複は Set で潰す。
    //
    // **並び順を固定するのは飢餓を避けるため**。無指定だと毎 tick ほぼ同じ先頭
    // 900 行が返り、901 件目以降は永久に検査されない (キューから消えても
    // stale にならず、pending のまま残り続ける)。`recordSyncedAt` の昇順なら
    // 見ていない行ほど先に来るので、上限で打ち切った回でも順に巡る。
    // SQLite は ASC で NULL を先頭に置くので、起点の無い行 (下の `undated`) も
    // 取りこぼさない。
    const rows = await prisma.episode.findMany({
      where: { recordStatus: { in: [...IN_FLIGHT] }, recordJobId: { not: null } },
      select: { recordJobId: true, recordSyncedAt: true },
      orderBy: { recordSyncedAt: 'asc' },
      take: MAX_TRACKED
    })
    const tracked = new Set<string>()
    // 猶予の起点を持たない行。下の stale 判定は `lt` なので NULL を拾わず、
    // 放っておくと **永久に落ちない** 行になる (キューにも居ないので heartbeat も
    // 当たらない)。record-intent は job id と同時に必ず入れるので、ここに来るのは
    // 手で書き換えた行や、この機能より前から残っている行。
    const undated = new Set<string>()
    for (const r of rows) {
      if (!r.recordJobId) continue
      tracked.add(r.recordJobId)
      if (r.recordSyncedAt === null) undated.add(r.recordJobId)
    }
    // 上限で打ち切ったかどうか。残りは次 tick が拾う (stale 判定は読めた行だけを
    // 対象にするので、打ち切った回でも判定そのものは有効)。
    if (rows.length >= MAX_TRACKED) logger.warn({ action: 'job-sync-tracked-truncated', limit: MAX_TRACKED })

    // 追跡対象が 1 件も無ければ nagisa を叩かない。毎分の cron なので、
    // 何も録画していない時間帯にリクエストを飛ばさないことに意味がある。
    if (tracked.size === 0) {
      result.skipped = true
      return result
    }

    // **観測時刻はリクエストを出す前に取る**。応答を読み終えた時刻にすると、
    // 取得が長引いた回に「古い不在」を今の不在として扱ってしまう:
    // 12:00 時点のキューに居なかったジョブが、12:01 に別 tick の heartbeat を
    // 受け取っていても、12:32 に読み終えた側の cutoff (12:02) がそれを追い越して
    // stale に落とす。開始時刻なら cutoff は必ず観測時点より手前に来るので、
    // 取得が遅れた回は「落としそこねる」側に倒れる (次 tick が拾う)。
    const now = new Date()
    const res = await fetchNagisaRaw(env as NagisaEnv, '/api/queue/snapshot')
    if (!res.ok) {
      // 取得できなかった回は何も書かない (全件 stale 化を防ぐ)。
      result.error = `queue snapshot ${res.status}`
      logger.warn({ action: 'job-sync-fetch-failed', status: res.status })
      return result
    }
    const snapshot = NagisaQueueSnapshotSchema.parse(await res.json())

    // **同じ job id が複数回来ても 1 件として数える**。キュー側が重複を返すと
    // チャンク数が追跡件数から見積もった上限を超え、D1 のクエリ数の保証が崩れる。
    const activeSet = new Set<string>()
    const liveSet = new Set<string>()
    const failures = new Map<string, string | null>()
    for (const job of snapshot.jobs) {
      // こちらが追跡していないジョブは 1 文も使わずに捨てる (交差)。
      if (!tracked.has(job.job_id)) continue
      // failed も「キューに居る」ことに変わりはないので heartbeat には含める。
      // 外すと、この tick で failed に落とし切れなかったぶん (下の件数上限) が
      // 無音扱いになり、30 分後に failed ではなく stale へ流れてしまう。
      liveSet.add(job.job_id)
      if (job.state === 'failed') failures.set(job.job_id, job.failed_reason)
      else if (job.state === 'active') activeSet.add(job.job_id)
    }
    const liveIds = [...liveSet]
    const activeIds = [...activeSet]

    // 生存確認 (heartbeat)。キューに居ることを確かめられた行の recordSyncedAt を
    // 毎 tick 進める。これが無いと recordSyncedAt は pending → downloading の
    // 1 回しか動かず、何時間も走ったジョブが消えた瞬間に「30 分無音」の条件を
    // 満たしてしまう (猶予がまったく効かない)。
    //
    // **既に入っている値より新しいときだけ書く**。cron が重なった回 (前の tick が
    // 1 分を超えた・手動同期と衝突した) に古い観測時刻で上書きすると、生存確認の
    // 履歴が巻き戻り、実際には無音になっていない行が 30 分後の条件を満たしてしまう。
    const monotonic = { OR: [{ recordSyncedAt: null }, { recordSyncedAt: { lt: now } }] }
    for (const part of chunk(liveIds, IN_CHUNK)) {
      await prisma.episode.updateMany({
        where: { recordStatus: { in: [...IN_FLIGHT] }, recordJobId: { in: part }, ...monotonic },
        data: { recordSyncedAt: now }
      })
    }

    // pending → downloading。active に現れた時点で実際に走っている。
    // ここも同じ理由で時刻の巻き戻しを避ける (状態だけ進めて時刻を戻すと、
    // downloading になった直後の行が猶予を食われる)。
    for (const part of chunk(activeIds, IN_CHUNK)) {
      const moved = await prisma.episode.updateMany({
        where: { recordStatus: 'pending', recordJobId: { in: part }, ...monotonic },
        data: { recordStatus: 'downloading', recordSource: 'snapshot', recordSyncedAt: now }
      })
      result.downloading += moved.count
    }

    // → failed。理由は BullMQ の failedReason をそのまま (長いので切り詰める)。
    //
    // 理由が 1 件ずつ違うので updateMany をまとめられない。交差済みなので件数は
    // ローカルの追跡数で頭打ちだが、それでも多ければこの tick の処理を打ち切る
    // (残りは次の tick が拾う。キューから消えるわけではない)。
    const failedIds = [...failures.keys()]
    if (failedIds.length > MAX_FAILED_PER_RUN) {
      logger.warn({ action: 'job-sync-failed-truncated', tracked: failedIds.length, limit: MAX_FAILED_PER_RUN })
    }
    for (const jobId of failedIds.slice(0, MAX_FAILED_PER_RUN)) {
      const hit = await prisma.episode.updateMany({
        where: { recordJobId: jobId, recordStatus: { in: [...IN_FLIGHT] } },
        data: {
          recordStatus: 'failed',
          recordSource: 'snapshot',
          recordError: (failures.get(jobId) ?? 'failed').slice(0, ERROR_MAX),
          recordSyncedAt: now
        }
      })
      result.failed += hit.count
    }

    // → stale。キューのどこにも居ない かつ 30 分無音のものだけ。
    // Redis の flush やワーカー再起動でジョブごと消えた状態を表す。
    // 「消えた = 失敗」ではないので failed とは別の状態にしておく
    // (実体があれば次の reconcile が completed で上書きする)。
    //
    // 対象は **この tick で読んだ行から、キューに居たものを引いた差** を
    // job id で名指しする。否定形 (`notIn` や「heartbeat が古い行」) では書かない:
    //   - `notIn` は D1 の bound parameter 上限 (100) を超え、分割すると意味が
    //     壊れる (どのチャンクにも属さない、が 1 クエリでは表せない)。
    //   - 「heartbeat が古い行」は読んだ集合の外まで巻き込む。上限で打ち切った回に
    //     キューで走っている行を落とし、並行して増えた行も巻き込む。
    // 肯定形なら読めた行だけが対象なので、打ち切った回でもそのまま落とせる。
    //
    // `recordSyncedAt` が null の行は猶予を測れないので対象外 (`lt` は NULL を
    // 拾わない)。録画指示を出す経路では pending と同時に recordSyncedAt を必ず入れること
    // — それでも null で来た行はこの直前で起点だけ入れ、次の tick 以降に回す。
    const staleIds = [...tracked].filter((id) => !liveSet.has(id))
    const cutoff = new Date(now.getTime() - STALE_AFTER_MS)

    // 起点の無い行には **まず起点を入れる**。この tick では落ちず、キューに戻って
    // こなければ 30 分後の tick で落ちる。いきなり stale にしないのは、起点が無い
    // ことと無音が続いていることは別だから (キューに入る前の一瞬かもしれない)。
    const undatedIds = staleIds.filter((id) => undated.has(id))
    if (undatedIds.length > 0) {
      logger.warn({ action: 'job-sync-undated-tracked', jobs: undatedIds.length })
      for (const part of chunk(undatedIds, IN_CHUNK)) {
        await prisma.episode.updateMany({
          where: { recordStatus: { in: [...IN_FLIGHT] }, recordJobId: { in: part }, recordSyncedAt: null },
          data: { recordSyncedAt: now }
        })
      }
    }
    for (const part of chunk(staleIds, IN_CHUNK)) {
      const gone = await prisma.episode.updateMany({
        where: {
          recordStatus: { in: [...IN_FLIGHT] },
          recordJobId: { in: part },
          recordSyncedAt: { lt: cutoff }
        },
        data: { recordStatus: 'stale', recordSource: 'snapshot', recordSyncedAt: now }
      })
      result.stale += gone.count
    }

    logger.info({
      action: 'job-sync-done',
      jobs: snapshot.jobs.length,
      downloading: result.downloading,
      failed: result.failed,
      stale: result.stale
    })
    return result
  } catch (e) {
    if (e instanceof NagisaConfigError) {
      logger.error({ action: 'job-sync-config-missing', missing: e.missing })
      result.error = e.message
      return result
    }
    const error = e instanceof Error ? e.message : String(e)
    logger.error({ action: 'job-sync-error', error })
    result.error = error
    return result
  }
}
