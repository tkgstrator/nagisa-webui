import { createRoute, z } from '@hono/zod-openapi'
import { lookupAnilistRecording } from '../../lib/anilist-recording'
import { createPrismaClient } from '../../lib/db'
import { AnimeRecordingStatusSchema } from '../../schemas/anime.dto'
import type { AnimeApp } from './bindings'

const ErrorSchema = z.object({ error: z.string().nonempty() })

export const registerRecordingStatus = (anime: AnimeApp) => {
  anime.openapi(
    createRoute({
      method: 'get',
      path: '/{id}/recording-status',
      tags: ['Anime'],
      summary: '同じ AniList 作品の録画状況を nagisa から取得',
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: '録画状況。nagisa に届かなかったときは error に理由が入る',
          content: { 'application/json': { schema: AnimeRecordingStatusSchema } }
        },
        404: {
          description: 'Not Found',
          content: { 'application/json': { schema: ErrorSchema } }
        }
      }
    }),
    async (c) => {
      const prisma = createPrismaClient(c.env.DB)
      const { id } = c.req.valid('param')

      const row = await prisma.anime.findUnique({ where: { id }, select: { aniListId: true } })
      if (!row) return c.json({ error: 'Not found' }, 404)
      // AniList に紐付いていない作品は nagisa 側でも引けない (対応を送れない)。
      if (row.aniListId <= 0) {
        return c.json(
          { aniListId: row.aniListId, error: 'Not linked to AniList', queueAvailable: false, titles: [] },
          200
        )
      }

      const result = await lookupAnilistRecording(prisma, c.env, row.aniListId)
      if (!result.ok) {
        return c.json({ aniListId: row.aniListId, error: result.error, queueAvailable: false, titles: [] }, 200)
      }

      const siblings = await prisma.anime.findMany({
        where: { aniListId: row.aniListId },
        select: { id: true, provider: true, contentId: true }
      })
      const byKey = new Map(siblings.map((s) => [`${s.provider}\u0000${s.contentId}`, s.id]))
      return c.json(
        {
          aniListId: row.aniListId,
          error: null,
          queueAvailable: result.data.queue_available,
          titles: result.data.titles.map((t) => ({
            animeId: byKey.get(`${t.provider}\u0000${t.content_id}`) ?? null,
            provider: t.provider,
            contentId: t.content_id,
            recordings: t.recordings,
            jobs: t.jobs
          }))
        },
        200
      )
    }
  )
}
