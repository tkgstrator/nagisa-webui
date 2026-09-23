import dayjs from 'dayjs'
import { createPrismaClient } from './lib/db'
import { notify } from './lib/discord'
import { createStore, flushLogs, runWithCapture } from './lib/log-capture'
import { collectLogGarbage } from './lib/log-gc'
import { getAppLogger } from './lib/logger'
import { sendMessage } from './lib/queue-routing'
import { finishRun, type RunStatus, startRun } from './lib/sync-run'
import type { Message } from './schemas/message.dto'

const logger = getAppLogger('scheduled')

interface Env {
  DB: D1Database
  AMAZON_QUEUE: Queue<Message>
  SYNC_QUEUE: Queue<Message>
  DISCORD_WEBHOOK_URL: string
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

export async function scheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const providers = ['hulu', 'amazon', 'crunchyroll', 'abema'] as const

  logger.debug({ action: 'trigger', cron: event.cron, scheduledTime: new Date(event.scheduledTime).toISOString() })

  // cron ハンドラは自前で prisma を持つ。enqueueAbemaArchive も同じクライアントを
  // 使い回すので、disconnect はこの関数の finally に一本化する。
  const prisma = createPrismaClient(env.DB)
  const runId = await startRun(prisma, { kind: 'cron', trigger: event.cron })
  // startRun のあとに store を作る。以降この run の中で出たログは
  // AsyncLocalStorage 経由で runId 付きで溜まる (src/lib/log-capture.ts)。
  const store = createStore(runId)

  let enqueued = 0
  let status: RunStatus = 'success'
  let failed = 0
  let errorMessage: string | undefined

  try {
    await runWithCapture(store, async () => {
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
            break
          case '0 4 * * *': {
            enqueued = await enqueueAbemaArchive(env, prisma, runId)
            logger.info({ action: 'enqueue-abema-archive', count: enqueued })
            // cron は Worker あたり 5 本が上限で空きが無いので、ログの GC はここに相乗りさせる。
            await collectLogGarbage(prisma)
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
    // flushLogs → finishRun → $disconnect の順を守る。src/lib/db.ts が
    // クライアントを使い回すので、disconnect 後の書き込みは失敗する。
    const droppedLogs = await flushLogs(prisma, store)
    await finishRun(prisma, runId, status, {
      total: enqueued,
      succeeded: enqueued,
      failed,
      droppedLogs,
      errorMessage
    })
    await prisma.$disconnect()
  }
}
