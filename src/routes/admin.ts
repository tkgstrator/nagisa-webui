import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import { getAppLogger } from '../lib/logger'
import { sendMessage } from '../lib/queue-routing'
import {
  ArchiveEnqueueResponseSchema,
  ArchiveStatsSchema,
  KeyArchiveRequestSchema,
  KeyArchiveStatsQuerySchema
} from '../schemas/archive.dto'
import type { Message } from '../schemas/message.dto'
import { PaginatedUnidentifiedSchema, UnidentifiedListQuerySchema } from '../schemas/unidentified.dto'

const logger = getAppLogger('routes')

type Bindings = {
  DB: D1Database
  AMAZON_QUEUE: Queue<Message>
  SYNC_QUEUE: Queue<Message>
}

const admin = new OpenAPIHono<{ Bindings: Bindings }>()

admin.openapi(
  createRoute({
    method: 'post',
    path: '/key-archive-requests',
    tags: ['Admin'],
    summary: '鍵未取得の anime をすべて HLS 鍵 archive キューに投入する (cron を待たない手動キック)',
    description: '未対応の provider は 400。応答は投入件数のみ (SyncRun は作らない)。',
    request: {
      body: { content: { 'application/json': { schema: KeyArchiveRequestSchema } }, required: true }
    },
    responses: {
      200: {
        description: 'キュー投入結果',
        content: { 'application/json': { schema: ArchiveEnqueueResponseSchema } }
      }
    }
  }),
  async (c) => {
    const { provider } = c.req.valid('json')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const animes = await prisma.anime.findMany({
        where: {
          provider,
          seasons: { some: { episodes: { some: { abemaKey: null } } } }
        },
        select: { id: true }
      })
      for (const anime of animes) {
        await sendMessage(c.env, { type: 'abema_archive', message: { animeId: anime.id } })
      }
      logger.info({ action: 'enqueue-key-archive', provider, count: animes.length })
      return c.json({ enqueued: animes.length }, 200)
    } finally {
      await prisma.$disconnect()
    }
  }
)

admin.openapi(
  createRoute({
    method: 'get',
    path: '/key-archives/stats',
    tags: ['Admin'],
    summary: 'HLS 鍵 archive の進捗 (anime 単位 / episode 単位)',
    request: { query: KeyArchiveStatsQuerySchema },
    responses: {
      200: {
        description: 'archive 進捗',
        content: { 'application/json': { schema: ArchiveStatsSchema } }
      }
    }
  }),
  async (c) => {
    const { provider } = c.req.valid('query')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const [totalAnime, animeWithMissingKey, totalEpisodes, archivedEpisodes] = await Promise.all([
        prisma.anime.count({ where: { provider } }),
        prisma.anime.count({
          where: {
            provider,
            seasons: { some: { episodes: { some: { abemaKey: null } } } }
          }
        }),
        prisma.episode.count({ where: { season: { anime: { provider } } } }),
        prisma.episode.count({
          where: { season: { anime: { provider } }, abemaKey: { isNot: null } }
        })
      ])
      return c.json(
        {
          totalAnime,
          animeFullyArchived: totalAnime - animeWithMissingKey,
          animeWithMissingKey,
          totalEpisodes,
          archivedEpisodes,
          pendingEpisodes: totalEpisodes - archivedEpisodes
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

admin.openapi(
  createRoute({
    method: 'get',
    path: '/unidentified-anime',
    tags: ['Admin'],
    summary: 'AniList で識別できなかったタイトル一覧 (ページネーション + provider/title 検索)',
    request: { query: UnidentifiedListQuerySchema },
    responses: {
      200: {
        description: '未識別タイトル一覧',
        content: { 'application/json': { schema: PaginatedUnidentifiedSchema } }
      }
    }
  }),
  async (c) => {
    const { page, limit, provider, q, order } = c.req.valid('query')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const where = {
        ...(provider ? { provider } : {}),
        ...(q ? { title: { contains: q } } : {})
      }
      const [total, rows] = await Promise.all([
        prisma.unidentifiedAnime.count({ where }),
        prisma.unidentifiedAnime.findMany({
          where,
          orderBy: { updatedAt: order },
          skip: (page - 1) * limit,
          take: limit
        })
      ])
      return c.json(
        {
          data: rows.map((r) => ({
            id: r.id,
            provider: r.provider,
            contentId: r.contentId,
            title: r.title,
            imageUrl: r.imageUrl,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
          })),
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

export default admin
