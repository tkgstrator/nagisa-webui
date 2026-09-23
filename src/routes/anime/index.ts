import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { cache } from 'hono/cache'
import { flattenAnime, QUARTER_TO_SEASON } from '../../lib/anime-flatten'
import { createPrismaClient } from '../../lib/db'
import { getAppLogger } from '../../lib/logger'
import { AnimeInfoSchema, AnimeListQuerySchema, AnimeSchema, PaginatedAnimeSchema } from '../../schemas/anime.dto'
import { RecordStatusEnum } from '../../schemas/recording.dto'
import { registerBadged } from './badged'
import type { Bindings } from './bindings'
import { registerRecord } from './record'
import { registerRecordingStatus } from './recording-status'
import { registerRefresh } from './refresh'

const logger = getAppLogger('routes')

const anime = new OpenAPIHono<{ Bindings: Bindings }>()

anime.use('/', cache({ cacheName: 'anime-list', cacheControl: 'public, s-maxage=30' }))
anime.use('/badged', cache({ cacheName: 'anime-badged', cacheControl: 'public, s-maxage=30' }))
// UUID regex scopes the middleware to /:id, so /badged (and future static children) don't get double-cached
anime.use(
  '/:id{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}',
  cache({ cacheName: 'anime-detail', cacheControl: 'public, s-maxage=30' })
)

anime.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Anime'],
    summary: 'アニメ一覧取得（ページネーション対応）',
    request: {
      query: AnimeListQuerySchema
    },
    responses: {
      200: {
        description: 'アニメ一覧',
        content: { 'application/json': { schema: PaginatedAnimeSchema } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    const { page, limit, provider, year, quarter, status, scheduled, recorded, badge, aniListId, sort, order, q } =
      c.req.valid('query')

    const anilistMediaFilter = {
      ...(year ? { OR: [{ seasonYear: year }, { AND: [{ seasonYear: null }, { startYear: year }] }] } : {}),
      ...(quarter != null ? { season: QUARTER_TO_SEASON[quarter] } : {}),
      ...(status ? { status } : {})
    }
    const where = {
      ...(provider ? { provider } : {}),
      ...(scheduled != null ? { scheduled } : {}),
      ...(recorded != null ? { recorded } : {}),
      ...(q ? { title: { contains: q } } : {}),
      ...(badge ? { badge } : {}),
      ...(aniListId ? { aniListId } : {}),
      ...(Object.keys(anilistMediaFilter).length > 0 ? { anilistMedia: anilistMediaFilter } : {})
    }
    const orderBy =
      sort === 'year'
        ? { anilistMedia: { seasonYear: order } }
        : sort === 'updatedAt'
          ? { updatedAt: order }
          : { title: order }

    const dbStart = performance.now()
    const [rows, total] = await Promise.all([
      prisma.anime.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { anilistMedia: true }
      }),
      prisma.anime.count({ where })
    ])
    const dbMs = performance.now() - dbStart
    const data = rows.map(flattenAnime)
    const totalPages = Math.ceil(total / limit)
    logger.info({
      action: 'anime-list',
      dbMs: Math.round(dbMs),
      rows: rows.length,
      total,
      filters: { year, quarter, status, provider, scheduled, recorded, badge, aniListId, q: q ? 'yes' : 'no' }
    })
    return c.json({ data, total, page, limit, totalPages })
  }
)

registerBadged(anime)

anime.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Anime'],
    summary: 'アニメ詳細取得（シーズン・エピソード含む）',
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'アニメ詳細',
        content: { 'application/json': { schema: AnimeInfoSchema } }
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
    const row = await prisma.anime.findUnique({
      where: { id },
      include: {
        anilistMedia: true,
        seasons: {
          orderBy: { seasonNumber: 'asc' },
          include: {
            episodes: {
              orderBy: { episodeNumber: 'asc' },
              include: { abemaKey: { select: { id: true } } }
            }
          }
        }
      }
    })
    if (!row) return c.json({ error: 'Not found' }, 404)
    const { seasons, ...animeBase } = row
    const flat = flattenAnime(animeBase)
    return c.json(
      {
        ...flat,
        seasons: seasons.map((s) => ({
          ...s,
          episodes: s.episodes.map(({ abemaKey, ...ep }) => ({
            ...ep,
            // DB 上はただの文字列なので、知らない値は none に畳む
            recordStatus: RecordStatusEnum.catch('none').parse(ep.recordStatus),
            hasLocalKey: abemaKey !== null
          }))
        }))
      },
      200
    )
  }
)

anime.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    tags: ['Anime'],
    summary: 'アニメの録画予約・録画済み状態を更新',
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              scheduled: z.boolean().optional(),
              recorded: z.boolean().optional()
            })
          }
        }
      }
    },
    responses: {
      200: {
        description: '更新完了',
        content: { 'application/json': { schema: AnimeSchema } }
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
      const result = await prisma.anime.update({
        where: { id },
        data: {
          ...(body.scheduled != null ? { scheduled: body.scheduled } : {}),
          ...(body.recorded != null ? { recorded: body.recorded } : {})
        },
        include: { anilistMedia: true }
      })
      return c.json(flattenAnime(result), 200)
    } catch (e) {
      logger.warn({ action: 'patch-not-found', id, error: e instanceof Error ? e.message : String(e) })
      return c.json({ error: 'Not found' }, 404)
    }
  }
)

registerRecord(anime)
registerRecordingStatus(anime)
registerRefresh(anime)

export default anime
