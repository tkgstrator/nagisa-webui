import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import { getAppLogger } from '../lib/logger'
import { BulkUpdateEpisodeSchema, UpdateEpisodeSchema } from '../schemas/recording.dto'

const logger = getAppLogger('routes')

type Bindings = { DB: D1Database }

const episodes = new OpenAPIHono<{ Bindings: Bindings }>()

/**
 * `Episode.id` (UUID)。プロバイダ側の ID である `Episode.episodeId` とは別物。
 */
const EpisodeIdParamsSchema = z.object({
  id: z.string().openapi({
    description: 'Episode.id (UUID)。プロバイダ側の ID である Episode.episodeId ではない',
    example: '0b6a2b3e-7a6a-4d3c-9f3e-1c2d3e4f5a6b'
  })
})

/**
 * Hono の query は文字列で届くので、`z.coerce.boolean()` だと `'false'` が true になる。
 * `'true'` / `'false'` の 2 値だけを受け付けて真偽に変換する。
 */
const EpisodeListQuerySchema = z.object({
  recorded: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .openapi({ description: '録画済みフラグで絞り込む。省略時は絞らない' })
})

episodes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Episodes'],
    summary: 'エピソード一覧',
    request: { query: EpisodeListQuerySchema },
    responses: {
      200: {
        description: 'エピソード一覧',
        content: {
          'application/json': {
            schema: z.array(
              z.object({
                id: z.string(),
                episodeNumber: z.number().int(),
                title: z.string(),
                recorded: z.boolean(),
                season: z.object({
                  displayName: z.string(),
                  anime: z.object({
                    id: z.string(),
                    title: z.string(),
                    provider: z.string(),
                    contentId: z.string()
                  })
                })
              })
            )
          }
        }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    const { recorded } = c.req.valid('query')
    const result = await prisma.episode.findMany({
      where: recorded === undefined ? undefined : { recorded },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        episodeNumber: true,
        title: true,
        recorded: true,
        season: {
          select: {
            displayName: true,
            anime: {
              select: { id: true, title: true, provider: true, contentId: true }
            }
          }
        }
      }
    })
    return c.json(result)
  }
)

// 静的パス `/` と `/{id}` は衝突しないが、一括更新を先に登録して意図を明示しておく
episodes.openapi(
  createRoute({
    method: 'patch',
    path: '/',
    tags: ['Episodes'],
    summary: '一括録画状態更新',
    description:
      'ids で指定した Episode.id (UUID) の recorded フラグをまとめて更新する。' +
      'updateMany 1 文で書くので原子的 (全件成功か全件失敗のどちらか)。',
    request: {
      body: { content: { 'application/json': { schema: BulkUpdateEpisodeSchema } } }
    },
    responses: {
      200: {
        description: '更新完了',
        content: { 'application/json': { schema: z.object({ updated: z.number() }) } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    const body = c.req.valid('json')
    const result = await prisma.episode.updateMany({
      where: { id: { in: body.ids } },
      data: { recorded: body.recorded }
    })
    return c.json({ updated: result.count })
  }
)

episodes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['Episodes'],
    summary: 'エピソード録画状態更新',
    description: 'recorded フラグだけを部分更新する。',
    request: {
      params: EpisodeIdParamsSchema,
      body: { content: { 'application/json': { schema: UpdateEpisodeSchema } } }
    },
    responses: {
      200: {
        description: '更新完了',
        content: { 'application/json': { schema: z.object({ id: z.string(), recorded: z.boolean() }) } }
      },
      404: {
        description: 'Not Found',
        content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const episode = await prisma.episode.update({
        where: { id },
        data: { recorded: body.recorded }
      })
      return c.json({ id: episode.id, recorded: episode.recorded }, 200)
    } catch (e) {
      logger.warn({
        action: 'update-not-found',
        episodeId: id,
        error: e instanceof Error ? e.message : String(e)
      })
      return c.json({ error: 'Episode not found' }, 404 as const)
    }
  }
)

export default episodes
