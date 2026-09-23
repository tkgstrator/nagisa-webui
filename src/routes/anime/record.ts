import { createRoute, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../../lib/db'
import { getAppLogger } from '../../lib/logger'
import { recordEvent } from '../../lib/recording-event'
import { NagisaQueueResponseSchema } from '../../schemas/nagisa.dto'
import type { AnimeApp } from './bindings'

const logger = getAppLogger('routes')

export const registerRecord = (anime: AnimeApp) => {
  anime.openapi(
    createRoute({
      method: 'post',
      path: '/{id}/record',
      tags: ['Anime'],
      summary: 'バックエンドに録画リクエストを送信',
      request: { params: z.object({ id: z.string() }) },
      responses: {
        200: {
          description: '録画リクエスト成功',
          content: { 'application/json': { schema: NagisaQueueResponseSchema } }
        },
        400: {
          description: '未録画エピソードなし',
          content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
        },
        404: {
          description: 'Not Found',
          content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
        },
        502: {
          description: 'バックエンドエラー',
          content: { 'application/json': { schema: z.object({ error: z.string().nonempty() }) } }
        }
      }
    }),
    async (c) => {
      const prisma = createPrismaClient(c.env.DB)
      const { id } = c.req.valid('param')
      const row = await prisma.anime.findUnique({
        where: { id },
        select: { provider: true, contentId: true, title: true }
      })
      if (!row) return c.json({ error: 'Not found' }, 404)

      // 未録画エピソードをシーズン情報付きで取得
      const unrecordedEpisodes = await prisma.episode.findMany({
        where: {
          recorded: false,
          season: { animeId: id }
        },
        select: { episodeNumber: true, season: { select: { seasonNumber: true } } },
        orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }]
      })

      if (unrecordedEpisodes.length === 0) {
        return c.json({ error: 'No unrecorded episodes' }, 400 as const)
      }

      // シーズンごとにエピソード番号をグループ化
      const seasonMap = new Map<number, number[]>()
      for (const ep of unrecordedEpisodes) {
        const sn = ep.season.seasonNumber
        const eps = seasonMap.get(sn)
        if (eps) {
          eps.push(ep.episodeNumber)
        } else {
          seasonMap.set(sn, [ep.episodeNumber])
        }
      }
      const seasons = [...seasonMap.entries()].map(([season_number, episodes]) => ({ season_number, episodes }))

      const requestBody = {
        provider: row.provider,
        items: [{ content_id: row.contentId, seasons }]
      }
      logger.info({ action: 'record-request', id, body: requestBody })

      /** 履歴 1 行ぶんの共通部分。結末だけ呼び出し側で足す。 */
      const event = {
        animeId: id,
        provider: row.provider,
        contentId: row.contentId,
        title: row.title,
        kind: 'request' as const,
        source: 'ui' as const,
        episodeCount: unrecordedEpisodes.length
      }

      let res: Response
      try {
        res = await fetch(`${c.env.BACKEND_URL}/api/queues`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Access-Client-Id': c.env.CF_ACCESS_CLIENT_ID,
            'CF-Access-Client-Secret': c.env.CF_ACCESS_CLIENT_SECRET
          },
          body: JSON.stringify(requestBody)
        })
      } catch (e) {
        // 接続自体が張れなかったとき。HTTP ステータスが無いので null で残す。
        const message = e instanceof Error ? e.message : String(e)
        logger.error({ action: 'record-backend-unreachable', id, provider: row.provider, error: message })
        await recordEvent(prisma, { ...event, status: 'error', errorMessage: `fetch failed: ${message}` })
        return c.json({ error: `Backend unreachable: ${message}` }, 502 as const)
      }

      if (!res.ok) {
        const text = await res.text()
        logger.error({
          action: 'record-backend-error',
          id,
          provider: row.provider,
          contentId: row.contentId,
          status: res.status,
          body: text
        })
        await recordEvent(prisma, { ...event, status: 'error', httpStatus: res.status, errorMessage: text })
        return c.json({ error: `Backend error: ${res.status} ${text}` }, 502 as const)
      }

      const data = await res.json()
      logger.info({
        action: 'record-sent',
        id,
        provider: row.provider,
        contentId: row.contentId,
        episodeCount: unrecordedEpisodes.length
      })
      await recordEvent(prisma, { ...event, status: 'ok', httpStatus: res.status })
      return c.json(data as NagisaQueueResponseSchema, 200)
    }
  )
}
