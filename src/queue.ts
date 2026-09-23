import { archiveMissingAbemaKeysForAnime } from './lib/abema-archive'
import { createPrismaClient } from './lib/db'
import { COLOR_SUCCESS, COLOR_WARN, notify } from './lib/discord'
import { enqueueImageWarm, warmImages } from './lib/image-warm'
import { createFetchClient } from './lib/lambda'
import { createStore, flushLogs, runWithCapture } from './lib/log-capture'
import { getAppLogger } from './lib/logger'
import { syncAnilistMediaYear } from './lib/metadata/anilist-sync'
import { resolveQueueForProvider } from './lib/queue-routing'
import { SyncService } from './lib/sync'
import { finishRun, resolveStatus, startRun } from './lib/sync-run'

import type { Message } from './schemas/message.dto'

const logger = getAppLogger('queue')

/** wrangler.toml の各 queue consumer (amazon/sync) の `max_retries` と揃える */
const MAX_RETRIES = 3
/** リトライ回数 (1〜MAX_RETRIES 回目) ごとのバックオフ秒数。throttle された相手を即座に叩き直さないため */
const RETRY_DELAY_SECONDS = [30, 120, 300]
/** 1 回の queue.sendBatch() に載せられる message 数の上限 (Cloudflare Queues の制約) */
const SEND_BATCH_SIZE = 100

interface Env {
  DB: D1Database
  TMDB_API_KEY: string
  AMAZON_QUEUE: Queue<Message>
  SYNC_QUEUE: Queue<Message>
  WARM_QUEUE: Queue<Message>
  KV: KVNamespace
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  LAMBDA_FUNCTION_URL: string
  LAMBDA_FUNCTION_URL_US: string
  DISCORD_WEBHOOK_URL: string
  IMAGES: R2Bucket
}

/** 失敗通知に載せるため、メッセージ対象のアニメ（識別済みなら）を引く */
async function findAnimeForMessage(
  prisma: ReturnType<typeof createPrismaClient>,
  body: Message
): Promise<{ title: string; imageUrl: string } | null> {
  if (body.type === 'update') {
    return prisma.anime.findUnique({
      where: { provider_contentId: { provider: body.message.provider, contentId: body.message.contentId } },
      select: { title: true, imageUrl: true }
    })
  }
  if (body.type === 'abema_archive') {
    return prisma.anime.findUnique({
      where: { id: body.message.animeId },
      select: { title: true, imageUrl: true }
    })
  }
  return null
}

/** Discord embed field value は 1024 文字まで。超えたら "...他N件" で切り詰める */
function truncateForFieldValue(lines: string[]): string {
  const MAX = 1024
  const buildSuffix = (rest: number) => `\n…他 ${rest} 件`
  const joinedLength = (xs: string[]) => (xs.length === 0 ? 0 : xs.reduce((acc, s) => acc + s.length + 1, -1))

  const collected: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const tentative = [...collected, line]
    const tentativeLen = joinedLength(tentative)
    // 全行入り切る場合は suffix 不要
    if (i === lines.length - 1 && tentativeLen <= MAX) {
      return tentative.join('\n')
    }
    // 行を足しても本文だけで 1024 以内なら確定して次へ
    if (tentativeLen <= MAX) {
      collected.push(line)
      continue
    }
    // ここで切り詰め確定。suffix が入る余地を作るため collected を後ろから削る
    const remaining = lines.length - i
    const suffix = buildSuffix(remaining)
    while (collected.length > 0 && joinedLength(collected) + suffix.length > MAX) {
      collected.pop()
    }
    return `${collected.join('\n')}${suffix}`
  }
  return collected.join('\n')
}

/**
 * amazon / sync / warm の 3 queue すべてがこの関数を consumer として呼ぶ (`batch.queue` に
 * queue 名が入る)。処理内容は `message.body.type` だけで一意に決まり、同じ type が複数の
 * queue から来ることはない (amazon queue は amazon 向け fetch/update のみ、sync queue は
 * それ以外の fetch/update と abema_archive/anilist_sync のみ、warm queue は image_warm のみ)
 * ので、`batch.queue` による分岐は不要。ログにだけ残して可観測性を確保する。
 */
export async function queue(batch: MessageBatch<Message>, env: Env): Promise<void> {
  const prisma = createPrismaClient(env.DB)
  const lambda = createFetchClient(env)
  const service = new SyncService(prisma, lambda)

  logger.info({ action: 'batch-start', batchSize: batch.messages.length, queue: batch.queue })

  // 1 バッチには複数の cron 由来のメッセージが混ざりうるので、親は最初に見つかった
  // 1 件だけを採る。どの run から来たかの内訳は meta に残す。
  const parentIds = [...new Set(batch.messages.map((m) => m.body.runId).filter((id) => id !== undefined))]
  const runId = await startRun(prisma, {
    kind: 'queue',
    trigger: 'batch',
    parentId: parentIds[0] ?? null
  })
  // startRun のあとに store を作る。以降この run の中で出たログは
  // AsyncLocalStorage 経由で runId 付きで溜まる (src/lib/log-capture.ts)。
  const store = createStore(runId)

  let succeeded = 0
  let failed = 0
  let retried = 0
  const failedLabels: string[] = []

  const processMessage = async (message: (typeof batch.messages)[number]): Promise<void> => {
    const body = message.body
    const meta: Record<string, unknown> = { action: 'process-message', type: body.type }
    if (body.type === 'fetch') {
      meta.provider = body.message.provider
      meta.category = body.message.category
    } else if (body.type === 'update') {
      meta.provider = body.message.provider
      meta.contentId = body.message.contentId
    } else if (body.type === 'abema_archive') {
      meta.animeId = body.message.animeId
    } else if (body.type === 'anilist_sync') {
      meta.year = body.message.year
    } else if (body.type === 'image_warm') {
      meta.provider = body.message.provider
      meta.count = body.message.urls.length
    }
    logger.debug(meta as { action: string })
    try {
      switch (message.body.type) {
        case 'fetch': {
          const { provider, category } = message.body.message
          const contentIds = await service.fetch(message.body)
          if (category !== 'expiring' && category !== 'coming_soon') {
            // fetch した provider と update 先の provider は常に同じなので、queue の解決は 1 回で済む
            const targetQueue = resolveQueueForProvider(env, provider)
            for (let i = 0; i < contentIds.length; i += SEND_BATCH_SIZE) {
              const chunk = contentIds.slice(i, i + SEND_BATCH_SIZE)
              await targetQueue.sendBatch(
                chunk.map((contentId) => ({
                  body: { type: 'update' as const, runId: message.body.runId, message: { provider, contentId } }
                }))
              )
            }
          }
          logger.info({ action: 'enqueue-updates', provider, category, count: contentIds.length })
          break
        }
        case 'update': {
          const { provider } = message.body.message
          const newImageUrls = await service.update(message.body)
          await enqueueImageWarm(env.WARM_QUEUE, provider, newImageUrls)
          break
        }
        case 'anilist_sync': {
          const { year, country } = message.body.message
          const result = await syncAnilistMediaYear({ prisma, year, country })
          logger.info({
            action: 'anilist-sync-year-done',
            year,
            country,
            fetched: result.fetched,
            pages: result.pages,
            elapsedMs: result.elapsedMs
          })
          break
        }
        case 'abema_archive': {
          const { animeId } = message.body.message
          const result = await archiveMissingAbemaKeysForAnime(prisma, animeId, async (programIds) => {
            const result = await lambda.fetchAbemaArchives({ programIds })
            return result.results
          })
          if (result.total === 0) {
            logger.info({ action: 'abema-archive-skip', animeId, reason: 'all keys present' })
            break
          }
          logger.info({
            action: 'abema-archive-done',
            animeId,
            total: result.total,
            ok: result.archived,
            fail: result.failed
          })
          break
        }
        case 'image_warm': {
          const { provider, urls } = message.body.message
          await warmImages(env.IMAGES, lambda, provider, urls)
          break
        }
      }
      message.ack()
      succeeded++
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      logger.error({
        action: 'process-error',
        type: message.body.type,
        body: message.body.message,
        error: errorMessage,
        attempts: message.attempts
      })
      // max_retries = 3 は「初回配信の後に 3 回再試行」なので attempts は 1〜4 まで来る。
      // attempts が MAX_RETRIES を超えたら今回が最後の配信 = これ以上 retry() を呼ばない
      // (呼ぶと DLQ に積む前提のリトライ上限管理と衝突し、通知も二重に飛ぶ)。
      const isFinalAttempt = message.attempts > MAX_RETRIES
      if (isFinalAttempt) {
        failed++
        const anime = await findAnimeForMessage(prisma, message.body).catch(() => null)
        failedLabels.push(anime ? anime.title : `[${message.body.type}]`)
      } else {
        const delaySeconds = RETRY_DELAY_SECONDS[message.attempts - 1] ?? RETRY_DELAY_SECONDS.at(-1)
        message.retry({ delaySeconds })
        retried++
      }
    }
  }

  try {
    await runWithCapture(store, async () => {
      await Promise.allSettled(batch.messages.map(processMessage))

      if (succeeded > 0 || failed > 0) {
        const fields: { name: string; value: string; inline?: boolean }[] = []
        if (failedLabels.length > 0) {
          fields.push({ name: '失敗一覧', value: truncateForFieldValue(failedLabels) })
        }
        await notify(env.DISCORD_WEBHOOK_URL, {
          title: 'Queue: バッチ完了',
          description: failed > 0 ? `成功 ${succeeded} 件 / 失敗 ${failed} 件` : `${succeeded} 件 正常に完了しました`,
          color: failed > 0 ? COLOR_WARN : COLOR_SUCCESS,
          fields
        })
      }
    })
  } finally {
    logger.debug({ action: 'batch-done', batchSize: batch.messages.length })
    // flushLogs → finishRun → $disconnect の順を守る。src/lib/db.ts が
    // クライアントを使い回すので、disconnect 後の書き込みは失敗する。
    const droppedLogs = await flushLogs(prisma, store)
    await finishRun(prisma, runId, resolveStatus(succeeded, failed), {
      total: batch.messages.length,
      succeeded,
      failed,
      retried,
      droppedLogs,
      meta: parentIds.length > 1 ? { parentIds } : undefined
    })
    await prisma.$disconnect()
  }
}
