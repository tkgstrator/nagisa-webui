import dayjs from 'dayjs'
import { createPrismaClient } from './lib/db'
import { notify } from './lib/discord'
import { syncJobs } from './lib/job-sync'
import { syncLibrary } from './lib/library-sync'
import { getAppLogger } from './lib/logger'
import { finishRun, startRun } from './lib/sync-run'
import type { Message } from './schemas/message.dto'

const logger = getAppLogger('scheduled')

interface Env {
  DB: D1Database
  SYNC_QUEUE: Queue<Message>
  DISCORD_WEBHOOK_URL: string
  BACKEND_URL?: string
  CF_ACCESS_CLIENT_ID?: string
  CF_ACCESS_CLIENT_SECRET?: string
}

async function enqueueAbemaArchive(env: Env, runId: string | null): Promise<number> {
  const prisma = createPrismaClient(env.DB)
  const animes = await prisma.anime.findMany({
    where: {
      provider: 'abema',
      seasons: { some: { episodes: { some: { abemaKey: null } } } }
    },
    select: { id: true }
  })
  for (const anime of animes) {
    await env.SYNC_QUEUE.send({ type: 'abema_archive', runId: runId ?? undefined, message: { animeId: anime.id } })
  }
  return animes.length
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
      if (event.cron === '* * * * *') await runJobSync(prisma, env)
      else await runLibrarySync(prisma, env)
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  const runId = await startRun(prisma, { kind: 'cron', trigger: event.cron })
  let enqueued = 0

  try {
    switch (event.cron) {
      case '0 */1 * * *':
        for (const provider of providers) {
          for (const category of ['new_episode', 'coming_soon'] as const) {
            await env.SYNC_QUEUE.send({ type: 'fetch', runId: runId ?? undefined, message: { provider, category } })
            logger.info({ action: 'enqueue', provider, category })
            enqueued++
          }
        }
        break
      case '0 0 * * *':
        for (const provider of providers) {
          await env.SYNC_QUEUE.send({
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
          await env.SYNC_QUEUE.send({
            type: 'fetch',
            runId: runId ?? undefined,
            message: { provider, category: 'catalog' }
          })
          logger.info({ action: 'enqueue', provider, category: 'catalog' })
          enqueued++
        }
        break
      case '0 4 * * *': {
        enqueued = await enqueueAbemaArchive(env, runId)
        logger.info({ action: 'enqueue-abema-archive', count: enqueued })
        break
      }
      // wrangler.toml の crons に書いた文字列がそのまま event.cron に来る。
      // "0 5 * * 0" と書くと一致せず default に落ちるので、定義と同じ SUN 表記にする。
      case '0 5 * * SUN': {
        const fromYear = 2000
        const toYear = dayjs().year() + 1
        const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)
        // AniList の rate limit を burst で殴らないよう、1 年あたり 30s ずらして enqueue
        for (const [i, year] of years.entries()) {
          await env.SYNC_QUEUE.send(
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
        await finishRun(prisma, runId, 'failed', { errorMessage: `unknown cron: ${event.cron}` })
        return
    }
    await finishRun(prisma, runId, 'success', { total: enqueued, succeeded: enqueued })
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    logger.error({ action: 'scheduled-error', cron: event.cron, error: errorMessage })
    await finishRun(prisma, runId, 'failed', { total: enqueued, succeeded: enqueued, failed: 1, errorMessage })
    await notify(env.DISCORD_WEBHOOK_URL, {
      title: 'Scheduled: キュー投入失敗',
      description: errorMessage,
      fields: [{ name: 'Cron', value: event.cron, inline: true }]
    })
  } finally {
    await prisma.$disconnect()
  }
}
