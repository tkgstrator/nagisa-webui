import dayjs from 'dayjs'
import { autoRecordSweep } from './lib/auto-record'
import { createPrismaClient } from './lib/db'
import { notify } from './lib/discord'
import type { JellyfinEnv } from './lib/jellyfin/client'
import { runJellyfinRefresh } from './lib/jellyfin/refresh'
import { syncJobs } from './lib/job-sync'
import { syncLibrary } from './lib/library-sync'
import { collectLogGarbage } from './lib/log-gc'
import { getAppLogger } from './lib/logger'
import { notifyIfAnilistStale } from './lib/metadata/anilist-staleness'
import { listActiveAnilistIdChunks } from './lib/metadata/anilist-sync'
import { sendMessage } from './lib/queue-routing'
import { runWithContext } from './lib/run-context'
import { finishRun, type RunStatus, startRun } from './lib/sync-run'
import type { Message } from './schemas/message.dto'

const logger = getAppLogger('scheduled')

interface Env extends Partial<JellyfinEnv> {
  DB: D1Database
  AMAZON_QUEUE: Queue<Message>
  SYNC_QUEUE: Queue<Message>
  DISCORD_WEBHOOK_URL: string
  BACKEND_URL?: string
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
}

async function enqueueAbemaArchive(env: Env, prisma: ReturnType<typeof createPrismaClient>, runId: string | null) {
  const animes = await prisma.anime.findMany({
    where: {
      provider: 'abema',
      seasons: { some: { episodes: { some: { abemaKey: null } } } }
    },
    select: { id: true }
  })
  for (const anime of animes) {
    await sendMessage(env, { type: 'abema_archive', runId: runId ?? undefined, message: { animeId: anime.id } })
  }
  return animes.length
}

/** RELEASING / NOT_YET_RELEASED の anilist_media を 50 件ずつの anilist_status メッセージにして投入する */
async function enqueueAnilistStatus(env: Env, prisma: ReturnType<typeof createPrismaClient>, runId: string | null) {
  const chunks = await listActiveAnilistIdChunks(prisma)
  for (const ids of chunks) {
    await sendMessage(env, { type: 'anilist_status', runId: runId ?? undefined, message: { ids } })
  }
  logger.info({ action: 'enqueue-anilist-status', chunks: chunks.length })
  return chunks.length
}

/**
 * ② ジョブ追従 (docs/features/recording-sync.md §6)。毎分走るので、
 * 追跡中のジョブが無い tick は SyncRun を 1 行も残さない
 * (/admin/logs が「何もしなかった」だけで埋まるのを避ける)。
 */
async function runJobSync(prisma: ReturnType<typeof createPrismaClient>, env: Env): Promise<void> {
  const startedAt = new Date()
  const result = await syncJobs(prisma, env)
  if (result.skipped && result.error === null) return

  const runId = await startRun(prisma, { kind: 'cron', trigger: 'job-sync', startedAt })
  const touched = result.downloading + result.failed + result.stale
  await finishRun(prisma, runId, result.error ? 'failed' : 'success', {
    total: touched,
    succeeded: touched,
    failed: result.error ? 1 : 0,
    errorMessage: result.error ?? undefined,
    meta: { downloading: result.downloading, failed: result.failed, stale: result.stale }
  })
}

/**
 * ②' Jellyfin のライブラリ更新 (docs/plans/06-jellyfin-refresh.md)。毎分走るので、
 * 送信しなかった tick (無効・dirty でない・静穏期間中・バックオフ中) は SyncRun を残さない。
 * 失敗しても throw しない (台帳同期や job-sync を巻き込まない)。
 */
async function runJellyfinRefreshTick(prisma: ReturnType<typeof createPrismaClient>, env: Env): Promise<void> {
  const startedAt = new Date()
  const r = await runJellyfinRefresh(prisma, env)
  if (!r.attempted) return

  const runId = await startRun(prisma, { kind: 'cron', trigger: 'jellyfin-refresh', startedAt })
  const ok = r.outcome === 'success'
  await finishRun(prisma, runId, ok ? 'success' : 'failed', {
    total: 1,
    succeeded: ok ? 1 : 0,
    failed: ok ? 0 : 1,
    errorMessage: r.error ?? undefined,
    meta: { status: r.status, attempt: r.attempt, generation: r.generation, outcome: r.outcome }
  })
}

/**
 * ③ reconcile (同 §7)。変更が無い tick は記録しない。
 * bootstrap が走った回数そのものが異常の指標なので、走った回は必ず残す。
 */
async function runLibrarySync(prisma: ReturnType<typeof createPrismaClient>, env: Env): Promise<void> {
  const startedAt = new Date()
  const r = await syncLibrary(prisma, env)
  const quiet = r.pages === 0 && r.bootstrap === null && r.aborted === null && r.error === null
  if (quiet) return

  const runId = await startRun(prisma, { kind: 'cron', trigger: 'library-sync', startedAt })
  const touched = r.upserts + r.deletes
  // aborted (mass_delete / epoch 変更) は「落ちてはいないが適用していない」なので partial。
  const status = r.error ? 'failed' : r.aborted ? 'partial' : 'success'
  await finishRun(prisma, runId, status, {
    total: touched,
    succeeded: touched,
    failed: r.error ? 1 : 0,
    errorMessage: r.error ?? r.aborted ?? undefined,
    meta: {
      pages: r.pages,
      upserts: r.upserts,
      deletes: r.deletes,
      unmatched: r.unmatched,
      bootstrap: r.bootstrap,
      aborted: r.aborted
    }
  })
}

export async function scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const providers = ['hulu', 'amazon', 'crunchyroll', 'abema'] as const

  logger.debug({ action: 'trigger', cron: event.cron, scheduledTime: new Date(event.scheduledTime).toISOString() })

  // cron ハンドラは自前で prisma を持つ。enqueueAbemaArchive も同じクライアントを
  // 使い回すので、disconnect はこの関数の finally に一本化する。
  const prisma = createPrismaClient(env.DB)

  // 録画同期の 2 本は Queue を介さず自前で完結する。何もしなかった tick を
  // 記録しない都合で startRun をハンドラ側に持つため、switch の前で分岐する。
  if (event.cron === '* * * * *' || event.cron === '*/15 * * * *') {
    try {
      if (event.cron === '* * * * *') {
        await runJobSync(prisma, env)
        await runJellyfinRefreshTick(prisma, env)
      } else await runLibrarySync(prisma, env)
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  const runId = await startRun(prisma, { kind: 'cron', trigger: event.cron })

  let enqueued = 0
  let status: RunStatus = 'success'
  let failed = 0
  let errorMessage: string | undefined

  try {
    // この中で出たログには properties.runId が付く (src/lib/run-context.ts)
    await runWithContext(runId, async () => {
      try {
        switch (event.cron) {
          case '0 */1 * * *':
            for (const provider of providers) {
              for (const category of ['new_episode', 'coming_soon'] as const) {
                await sendMessage(env, { type: 'fetch', runId: runId ?? undefined, message: { provider, category } })
                logger.info({ action: 'enqueue', provider, category })
                enqueued++
              }
            }
            // update を待たずに、予約済み作品の配信済み未録画回を送る (DB と nagisa のみ。OFF なら何もしない)
            await autoRecordSweep(prisma, env)
            break
          case '0 0 * * *':
            for (const provider of providers) {
              await sendMessage(env, {
                type: 'fetch',
                runId: runId ?? undefined,
                message: { provider, category: 'expiring' }
              })
              logger.info({ action: 'enqueue', provider, category: 'expiring' })
              enqueued++
            }
            break
          case '0 3 * * *':
            for (const provider of providers) {
              await sendMessage(env, {
                type: 'fetch',
                runId: runId ?? undefined,
                message: { provider, category: 'catalog' }
              })
              logger.info({ action: 'enqueue', provider, category: 'catalog' })
              enqueued++
            }
            // 放送中・放送予定の AniList 行を id_in で再取得 (cron は上限 5 本なので毎朝の枠に相乗り)
            enqueued += await enqueueAnilistStatus(env, prisma, runId)
            break
          case '0 4 * * *': {
            enqueued = await enqueueAbemaArchive(env, prisma, runId)
            logger.info({ action: 'enqueue-abema-archive', count: enqueued })
            // cron は Worker あたり 5 本が上限で空きが無いので、ログの GC はここに相乗りさせる。
            await collectLogGarbage(prisma)
            // unidentified_anime の一括再識別も相乗り。以降のチャンクは queue 側が自分で続きを積む。
            await sendMessage(env, {
              type: 'reidentify_unidentified',
              runId: runId ?? undefined,
              message: { limit: 100 }
            })
            enqueued += 1
            break
          }
          // wrangler.toml の crons に書いた文字列がそのまま event.cron に来る。
          // "0 5 * * 0" と書くと一致せず default に落ちるので、定義と同じ SUN 表記にする。
          case '0 5 * * SUN': {
            // 先に前回までの同期が止まっていないか確認する (通知失敗で enqueue を止めない)
            await notifyIfAnilistStale(prisma, env.DISCORD_WEBHOOK_URL).catch((e: unknown) =>
              logger.error({ action: 'anilist-stale-check-failed', error: e instanceof Error ? e.message : String(e) })
            )
            const fromYear = 2000
            const toYear = dayjs().year() + 1
            const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)
            // AniList の rate limit を burst で殴らないよう、1 年あたり 30s ずらして enqueue
            for (const [i, year] of years.entries()) {
              await sendMessage(
                env,
                { type: 'anilist_sync', runId: runId ?? undefined, message: { year, country: 'JP' } },
                { delaySeconds: i * 30 }
              )
            }
            enqueued = years.length
            logger.info({ action: 'enqueue-anilist-sync', fromYear, toYear, count: years.length })
            break
          }
          default:
            logger.warn({ action: 'unknown-cron', cron: event.cron })
            status = 'failed'
            errorMessage = `unknown cron: ${event.cron}`
        }
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : String(e)
        status = 'failed'
        failed = 1
        logger.error({ action: 'scheduled-error', cron: event.cron, error: errorMessage })
        await notify(env.DISCORD_WEBHOOK_URL, {
          title: 'Scheduled: キュー投入失敗',
          description: errorMessage,
          fields: [{ name: 'Cron', value: event.cron, inline: true }]
        })
      }
    })
  } finally {
    await finishRun(prisma, runId, status, {
      total: enqueued,
      succeeded: enqueued,
      failed,
      errorMessage
    })
    await prisma.$disconnect()
  }
}
