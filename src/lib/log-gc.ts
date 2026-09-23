import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'

const logger = getAppLogger('log-gc')

type Prisma = ReturnType<typeof createPrismaClient>

/** 生ログの保持期間。1 日 2〜3 万行なので長く持つと D1 の行数がすぐ膨らむ。 */
const LOG_ENTRY_RETENTION_DAYS = 14

/** 実行記録の保持期間。1 日 200 行程度なので長めに持てる。 */
const SYNC_RUN_RETENTION_DAYS = 90

/** 録画イベントの保持期間。作品ページの録画履歴に出すので長めに持つ。 */
const RECORDING_EVENT_RETENTION_DAYS = 180

/** カタログ変化の保持期間。作品単位 1 行にまとめているので 1 日数百行程度。 */
const CATALOG_EVENT_RETENTION_DAYS = 90

/** 1 回の DELETE が触る id の幅。D1 の 1 クエリを短く保つための刻み。 */
const DELETE_CHUNK = 30_000

/** 1 回の GC で回す DELETE の上限。溜まりすぎていても cron 1 回で無理に消し切らない。 */
const MAX_LOOPS = 10

export interface GcResult {
  logEntries: number
  syncRuns: number
  recordingEvents: number
  catalogEvents: number
  /** 上限まで回しても消し残りがあるか (次回の GC に持ち越す) */
  truncated: boolean
}

/**
 * 保持期間を過ぎた log_entries / sync_runs / recording_events / catalog_events を消す。
 * cron は Worker あたり 5 本が上限で既に使い切っているので、専用 cron は作らず
 * `0 4 * * *` (ABEMA 鍵アーカイブ) に相乗りさせて呼ぶ。
 */
export async function collectLogGarbage(prisma: Prisma, now: Date = new Date()): Promise<GcResult> {
  const day = 24 * 60 * 60 * 1000
  const logCutoff = new Date(now.getTime() - LOG_ENTRY_RETENTION_DAYS * day)
  const runCutoff = new Date(now.getTime() - SYNC_RUN_RETENTION_DAYS * day)
  const recordingCutoff = new Date(now.getTime() - RECORDING_EVENT_RETENTION_DAYS * day)
  const catalogCutoff = new Date(now.getTime() - CATALOG_EVENT_RETENTION_DAYS * day)

  let logEntries = 0
  let truncated = false

  // id は autoincrement なので ts とほぼ同じ順序に並ぶ。境界の id を 1 度だけ引いて、
  // あとは id の範囲で削る (ts で条件を書くと毎回テーブルを走査することになる)。
  const boundary = await prisma.logEntry.findFirst({
    where: { ts: { lt: logCutoff } },
    orderBy: { id: 'desc' },
    select: { id: true }
  })
  if (boundary !== null) {
    const first = await prisma.logEntry.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
    let cursor = first?.id ?? boundary.id
    let loops = 0
    while (cursor <= boundary.id && loops < MAX_LOOPS) {
      const upto = Math.min(cursor + DELETE_CHUNK - 1, boundary.id)
      const { count } = await prisma.logEntry.deleteMany({ where: { id: { lte: upto } } })
      logEntries += count
      cursor = upto + 1
      loops++
    }
    truncated = cursor <= boundary.id
  }

  const { count: syncRuns } = await prisma.syncRun.deleteMany({ where: { startedAt: { lt: runCutoff } } })
  const { count: recordingEvents } = await prisma.recordingEvent.deleteMany({
    where: { createdAt: { lt: recordingCutoff } }
  })
  const { count: catalogEvents } = await prisma.catalogEvent.deleteMany({ where: { createdAt: { lt: catalogCutoff } } })

  logger.info({
    action: 'log-gc-done',
    logEntries,
    syncRuns,
    recordingEvents,
    catalogEvents,
    truncated,
    logCutoff: logCutoff.toISOString(),
    runCutoff: runCutoff.toISOString()
  })

  return { logEntries, syncRuns, recordingEvents, catalogEvents, truncated }
}
