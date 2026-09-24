import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'

const logger = getAppLogger('sync-run')

type Prisma = ReturnType<typeof createPrismaClient>

/** cron 起動 / Queue バッチ / 手動操作。sync_runs.kind に入る値。 */
export type RunKind = 'cron' | 'queue' | 'manual'

/** running のまま残っている行は「途中で Worker が死んだ run」を意味する。 */
export type RunStatus = 'success' | 'partial' | 'failed'

export interface RunCounters {
  total?: number
  succeeded?: number
  failed?: number
  retried?: number
  animeCreated?: number
  animeUpdated?: number
  errorMessage?: string
  meta?: Record<string, unknown>
}

/** meta は JSON 文字列で持つ。壊れた値で run 記録ごと落とさないよう握り潰す。 */
function serializeMeta(meta: Record<string, unknown> | undefined): string | null {
  if (meta === undefined) return null
  try {
    const json = JSON.stringify(meta)
    return json.length > 4096 ? json.slice(0, 4096) : json
  } catch {
    return null
  }
}

/**
 * 実行記録を開始する。ログの都合で本処理を巻き込んで落とすことがないよう、
 * 失敗しても throw せず null を返す。null の runId は以降すべて無視される。
 */
export async function startRun(
  prisma: Prisma,
  params: { kind: RunKind; trigger: string; parentId?: string | null; startedAt?: Date }
): Promise<string | null> {
  try {
    const run = await prisma.syncRun.create({
      data: {
        kind: params.kind,
        trigger: params.trigger,
        parentId: params.parentId ?? null,
        status: 'running',
        // 「何もしなかった tick は記録しない」cron 用。処理が終わってから
        // 記録を起こす場合でも durationMs を実時間にするために渡す。
        ...(params.startedAt ? { startedAt: params.startedAt } : {})
      },
      select: { id: true }
    })
    return run.id
  } catch (e) {
    logger.warn({ action: 'start-run-failed', kind: params.kind, trigger: params.trigger, error: String(e) })
    return null
  }
}

/**
 * 実行記録を閉じる。`startRun` が null を返していた場合は何もしない。
 * prisma.$disconnect() より前に必ず呼ぶこと (db.ts がクライアントを使い回すので
 * disconnect 後の書き込みは失敗する)。
 */
export async function finishRun(
  prisma: Prisma,
  runId: string | null,
  status: RunStatus,
  counters: RunCounters = {}
): Promise<void> {
  if (runId === null) return
  const finishedAt = new Date()
  try {
    const run = await prisma.syncRun.findUnique({ where: { id: runId }, select: { startedAt: true } })
    await prisma.syncRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt,
        durationMs: run === null ? null : finishedAt.getTime() - run.startedAt.getTime(),
        total: counters.total ?? 0,
        succeeded: counters.succeeded ?? 0,
        failed: counters.failed ?? 0,
        retried: counters.retried ?? 0,
        animeCreated: counters.animeCreated ?? 0,
        animeUpdated: counters.animeUpdated ?? 0,
        errorMessage: counters.errorMessage ?? null,
        meta: serializeMeta(counters.meta)
      }
    })
  } catch (e) {
    logger.warn({ action: 'finish-run-failed', runId, error: String(e) })
  }
}

/** 失敗が混ざったかどうかで status を決める。 */
export function resolveStatus(succeeded: number, failed: number): RunStatus {
  if (failed === 0) return 'success'
  return succeeded > 0 ? 'partial' : 'failed'
}
