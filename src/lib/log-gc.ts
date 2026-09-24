import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'

const logger = getAppLogger('log-gc')

type Prisma = ReturnType<typeof createPrismaClient>

/** 実行記録の保持期間。1 日 200 行程度なので長めに持てる。 */
const SYNC_RUN_RETENTION_DAYS = 90

/** 録画イベントの保持期間。作品ページの録画履歴に出すので長めに持つ。 */
const RECORDING_EVENT_RETENTION_DAYS = 180

/** カタログ変化の保持期間。作品単位 1 行にまとめているので 1 日数百行程度。 */
const CATALOG_EVENT_RETENTION_DAYS = 90

export interface GcResult {
  syncRuns: number
  recordingEvents: number
  catalogEvents: number
}

/**
 * 保持期間を過ぎた sync_runs / recording_events / catalog_events を消す。
 * 生ログは Workers Logs 側 (保持 7 日) にしか無いので、ここでは扱わない。
 * cron は Worker あたり 5 本が上限で既に使い切っているので、専用 cron は作らず
 * `0 4 * * *` (ABEMA 鍵アーカイブ) に相乗りさせて呼ぶ。
 */
export async function collectLogGarbage(prisma: Prisma, now: Date = new Date()): Promise<GcResult> {
  const day = 24 * 60 * 60 * 1000
  const runCutoff = new Date(now.getTime() - SYNC_RUN_RETENTION_DAYS * day)
  const recordingCutoff = new Date(now.getTime() - RECORDING_EVENT_RETENTION_DAYS * day)
  const catalogCutoff = new Date(now.getTime() - CATALOG_EVENT_RETENTION_DAYS * day)

  const { count: syncRuns } = await prisma.syncRun.deleteMany({ where: { startedAt: { lt: runCutoff } } })
  const { count: recordingEvents } = await prisma.recordingEvent.deleteMany({
    where: { createdAt: { lt: recordingCutoff } }
  })
  const { count: catalogEvents } = await prisma.catalogEvent.deleteMany({ where: { createdAt: { lt: catalogCutoff } } })

  logger.info({
    action: 'log-gc-done',
    syncRuns,
    recordingEvents,
    catalogEvents,
    runCutoff: runCutoff.toISOString()
  })

  return { syncRuns, recordingEvents, catalogEvents }
}
