import { createRoute, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../../lib/db'
import { getAppLogger } from '../../lib/logger'
import { enqueueRecording } from '../../lib/record-enqueue'
import { type RecordAnimeRequest, RecordAnimeRequestSchema } from '../../schemas/anime.dto'
import { NagisaEnqueueRequestSchema, NagisaQueueResponseSchema } from '../../schemas/nagisa.dto'
import type { AnimeApp } from './bindings'

const logger = getAppLogger('routes')

const ErrorSchema = z.object({ error: z.string().nonempty() })

export const registerRecord = (anime: AnimeApp) => {
  anime.openapi(
    createRoute({
      method: 'post',
      path: '/{id}/record',
      tags: ['Anime'],
      summary: 'バックエンドに録画リクエストを送信',
      request: {
        params: z.object({ id: z.string() }),
        body: { required: false, content: { 'application/json': { schema: RecordAnimeRequestSchema } } }
      },
      responses: {
        200: {
          description: '録画リクエスト成功',
          content: { 'application/json': { schema: NagisaQueueResponseSchema } }
        },
        400: {
          description: '送る回が無い',
          content: { 'application/json': { schema: ErrorSchema } }
        },
        404: {
          description: 'Not Found',
          content: { 'application/json': { schema: ErrorSchema } }
        },
        502: {
          description: 'バックエンドエラー',
          content: { 'application/json': { schema: ErrorSchema } }
        }
      }
    }),
    async (c) => {
      const prisma = createPrismaClient(c.env.DB)
      const { id } = c.req.valid('param')
      // body を省いた呼び出しでは validator が走らず undefined が来る。
      const episodeIds = (c.req.valid('json') as RecordAnimeRequest)?.episodeIds

      const row = await prisma.anime.findUnique({
        where: { id },
        select: { provider: true, contentId: true }
      })
      if (!row) return c.json({ error: 'Not found' }, 404)
      // netflix など nagisa が録れない配信元はここで弾く。
      const provider = NagisaEnqueueRequestSchema.shape.provider.safeParse(row.provider)
      if (!provider.success) return c.json({ error: `Unsupported provider: ${row.provider}` }, 400 as const)

      const episodes = await prisma.episode.findMany({
        where: { season: { animeId: id }, ...(episodeIds ? {} : { recorded: false }) },
        select: { id: true, episodeNumber: true, season: { select: { seasonNumber: true } } },
        orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }]
      })
      // 指定分は IN 句にせずメモリで絞る。1 作品の話数は D1 の bind 上限を超えうる。
      const wanted = episodeIds ? new Set<string>(episodeIds) : null
      const targets = episodes.filter(
        (ep) => (wanted === null || wanted.has(ep.id)) && ep.season.seasonNumber > 0 && ep.episodeNumber > 0
      )
      if (targets.length === 0) {
        return c.json({ error: episodeIds ? 'No matching episodes' : 'No unrecorded episodes' }, 400 as const)
      }

      // シーズンごとにエピソード番号をグループ化
      const seasonMap = new Map<number, number[]>()
      for (const ep of targets) {
        const eps = seasonMap.get(ep.season.seasonNumber)
        if (eps) eps.push(ep.episodeNumber)
        else seasonMap.set(ep.season.seasonNumber, [ep.episodeNumber])
      }
      const seasons = [...seasonMap.entries()].map(([season_number, episodes]) => ({ season_number, episodes }))

      logger.info({ action: 'record-request', id, episodeCount: targets.length })
      const result = await enqueueRecording(
        prisma,
        c.env,
        {
          provider: provider.data,
          items: [{ content_id: row.contentId, seasons }]
        },
        'manual'
      )
      if (!result.ok) return c.json({ error: result.error }, 502 as const)
      return c.json(result.data, 200)
    }
  )
}
