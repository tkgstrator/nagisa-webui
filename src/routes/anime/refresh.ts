import { createRoute, z } from '@hono/zod-openapi'
import { archiveMissingAbemaKeysForAnime } from '../../lib/abema-archive'
import { autoRecordScheduled } from '../../lib/auto-record'
import { createPrismaClient } from '../../lib/db'
import { enqueueImageWarm } from '../../lib/image-warm'
import { type JobSyncResult, syncJobs } from '../../lib/job-sync'
import { createFetchClient } from '../../lib/lambda'
import { type LibrarySyncResult, syncLibrary } from '../../lib/library-sync'
import { localDetailFetchers } from '../../lib/local-detail-fetchers'
import { createStore, flushLogs, runWithCapture } from '../../lib/log-capture'
import { getAppLogger } from '../../lib/logger'
import { SyncService } from '../../lib/sync'
import { finishRun, startRun } from '../../lib/sync-run'
import { RefreshAnimeResponseSchema } from '../../schemas/anime.dto'
import { ProviderTypeEnum } from '../../schemas/message.dto'
import type { AnimeApp } from './bindings'

const logger = getAppLogger('routes')

export const registerRefresh = (anime: AnimeApp) => {
  anime.openapi(
    createRoute({
      method: 'post',
      path: '/{id}/refresh',
      tags: ['Anime'],
      summary: 'タイトル詳細とエピソード情報を再取得',
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: '再取得成功',
          content: { 'application/json': { schema: RefreshAnimeResponseSchema } }
        },
        404: {
          description: 'Not Found',
          content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
        },
        500: {
          description: '再取得失敗',
          content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
        }
      }
    }),
    async (c) => {
      const prisma = createPrismaClient(c.env.DB)
      const { id } = c.req.valid('param')
      const row = await prisma.anime.findUnique({
        where: { id },
        select: { provider: true, contentId: true }
      })
      if (!row) return c.json({ error: 'Not found' }, 404)

      const result = ProviderTypeEnum.safeParse(row.provider)
      if (!result.success) return c.json({ error: `Unsupported provider: ${row.provider}` }, 500)

      const lambda = createFetchClient(c.env)
      const service = new SyncService(prisma, lambda)
      const fetcher = localDetailFetchers[result.data]

      // 手動操作も実行履歴に残す。ここで作った store のおかげで、この 1 リクエストの
      // 中で出たログだけが runId 付きで溜まる (同時に叩かれても混ざらない)。
      const runId = await startRun(prisma, { kind: 'manual', trigger: 'refresh' })
      const store = createStore(runId)
      let errorMessage: string | undefined
      let jobs: JobSyncResult | undefined
      let library: LibrarySyncResult | undefined

      try {
        await runWithCapture(store, async () => {
          try {
            // 新規に入った / URL が変わった画像は queue 経由で warm する。
            // SyncService は副作用を持たず URL を返すだけなので、送信はこの呼び出し元の責務。
            const newImageUrls = fetcher
              ? await service.applyDetail(result.data, row.contentId, await fetcher(row.contentId))
              : await service.update({ type: 'update', message: { provider: result.data, contentId: row.contentId } })
            await enqueueImageWarm(c.env.WARM_QUEUE, result.data, newImageUrls)
            if (result.data === 'abema') {
              try {
                const archive = await archiveMissingAbemaKeysForAnime(prisma, id, async (programIds) => {
                  const result = await lambda.fetchAbemaArchives({ programIds })
                  return result.results
                })
                logger.info({
                  action: 'refresh-abema-archive-done',
                  id,
                  provider: row.provider,
                  contentId: row.contentId,
                  total: archive.total,
                  ok: archive.archived,
                  fail: archive.failed
                })
              } catch (e) {
                logger.warn({
                  action: 'refresh-abema-archive-error',
                  id,
                  provider: row.provider,
                  contentId: row.contentId,
                  error: e instanceof Error ? e.message : String(e)
                })
              }
            }
            logger.info({ action: 'refresh-ok', id, provider: row.provider, contentId: row.contentId })
          } catch (e) {
            errorMessage = e instanceof Error ? e.message : String(e)
            logger.error({
              action: 'refresh-error',
              id,
              provider: row.provider,
              contentId: row.contentId,
              error: errorMessage
            })
          }

          // 配信元の情報とは独立なので、上の再取得が落ちても録画状態は取りに行く。
          // 追従 (進行中ジョブ) → 台帳 (completed) の順は cron と同じ。どちらも throw しない。
          jobs = await syncJobs(prisma, c.env)
          library = await syncLibrary(prisma, c.env)
          if (jobs.error || library.error) {
            logger.warn({ action: 'refresh-recording-sync-error', id, jobs: jobs.error, library: library.error })
          }
          // 手動の再取得で見つかった回も、予約済み作品なら自動録画に回す (経路は cron と同じ)。
          // 台帳同期の後に置くのは、既に録れている回を completed にしてから選ぶため
          await autoRecordScheduled(prisma, c.env, row.provider, row.contentId)
        })
      } finally {
        // flushLogs → finishRun の順を守る (src/lib/db.ts のクライアント使い回し都合)。
        const droppedLogs = await flushLogs(prisma, store)
        await finishRun(prisma, runId, errorMessage === undefined ? 'success' : 'failed', {
          total: 1,
          succeeded: errorMessage === undefined ? 1 : 0,
          failed: errorMessage === undefined ? 0 : 1,
          droppedLogs,
          errorMessage,
          meta: {
            animeId: id,
            provider: row.provider,
            contentId: row.contentId,
            jobSync: jobs ?? null,
            librarySync: library ?? null
          }
        })
      }

      if (errorMessage !== undefined) return c.json({ error: errorMessage }, 500)
      return c.json(
        {
          contentId: row.contentId,
          provider: row.provider,
          sync: {
            jobs: {
              downloading: jobs?.downloading ?? 0,
              failed: jobs?.failed ?? 0,
              stale: jobs?.stale ?? 0,
              error: jobs?.error ?? null
            },
            library: {
              skipped: library?.skipped ?? false,
              upserts: library?.upserts ?? 0,
              deletes: library?.deletes ?? 0,
              error: library?.error ?? null
            }
          }
        },
        200
      )
    }
  )
}
