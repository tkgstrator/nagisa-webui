import { createRoute } from '@hono/zod-openapi'
import { getAppLogger } from '../../lib/logger'
import { BadgedAnimeSchema } from '../../schemas/anime.dto'
import type { AnimeApp } from './bindings'

const logger = getAppLogger('routes')

type BadgedRow = {
  id: string
  title: string
  description: string
  provider: string
  content_id: string
  entity_type: string
  maturity_rating: number | null
  image_url: string
  anilist_id: number
  badge: string
  next_episode_date: string | null
  expired_at: string | null
  expiring_season: number | null
  scheduled: number
  recorded: number
  created_at: string
  updated_at: string
  am_season: string | null
  am_season_year: number | null
  am_start_year: number | null
  am_start_month: number | null
  am_status: string
}

const BADGE_KEYS = ['NEW_EPISODE', 'RECENTLY_ADDED', 'COMING_SOON', 'EXPIRING'] as const
type BadgeKey = (typeof BADGE_KEYS)[number]

function isBadgeKey(v: string): v is BadgeKey {
  return (BADGE_KEYS as readonly string[]).includes(v)
}

const SEASON_TO_QUARTER: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const MONTH_TO_QUARTER = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] as const

type FlatBadgedAnime = {
  id: string
  title: string
  description: string
  provider: string
  contentId: string
  entityType: string
  maturityRating: number | null
  imageUrl: string
  aniListId: number
  badge: string
  nextEpisodeDate: string | null
  expiredAt: string | null
  expiringSeason: number | null
  scheduled: boolean
  recorded: boolean
  createdAt: string
  updatedAt: string
  year: number
  quarter: number
  status: string
}

function rawBadgedRowToFlat(row: BadgedRow): FlatBadgedAnime {
  const year = row.am_season_year ?? row.am_start_year ?? 0
  const quarter = row.am_season
    ? (SEASON_TO_QUARTER[row.am_season] ?? 0)
    : row.am_start_month != null
      ? MONTH_TO_QUARTER[row.am_start_month - 1]
      : 0
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    provider: row.provider,
    contentId: row.content_id,
    entityType: row.entity_type,
    maturityRating: row.maturity_rating,
    imageUrl: row.image_url,
    aniListId: row.anilist_id,
    badge: row.badge,
    nextEpisodeDate: row.next_episode_date,
    expiredAt: row.expired_at,
    expiringSeason: row.expiring_season,
    scheduled: row.scheduled === 1,
    recorded: row.recorded === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    year,
    quarter,
    status: row.am_status
  }
}

export const registerBadged = (anime: AnimeApp) => {
  anime.openapi(
    createRoute({
      method: 'get',
      path: '/badged',
      tags: ['Anime'],
      summary: 'バッジ付きアニメをバッジ種別ごとにグループ化して取得',
      responses: {
        200: {
          description: 'バッジ別アニメ一覧',
          content: { 'application/json': { schema: BadgedAnimeSchema } }
        }
      }
    }),
    async (c) => {
      const dbStart = performance.now()
      const { results } = await c.env.DB.prepare(
        `SELECT
           a.id, a.title, a.description, a.provider, a.content_id, a.entity_type,
           a.maturity_rating, a.image_url, a.anilist_id, a.badge,
           a.next_episode_date, a.expired_at, a.expiring_season,
           a.scheduled, a.recorded, a.created_at, a.updated_at,
           am.season AS am_season, am.season_year AS am_season_year,
           am.start_year AS am_start_year, am.start_month AS am_start_month,
           am.status AS am_status
         FROM anime a
         INNER JOIN anilist_media am ON a.anilist_id = am.id
         WHERE a.badge IS NOT NULL
         ORDER BY a.title ASC`
      ).all<BadgedRow>()
      const dbMs = performance.now() - dbStart

      const result: Record<BadgeKey, FlatBadgedAnime[]> = {
        NEW_EPISODE: [],
        RECENTLY_ADDED: [],
        COMING_SOON: [],
        EXPIRING: []
      }
      for (const row of results) {
        const badge = row.badge
        if (!isBadgeKey(badge)) continue
        result[badge].push(rawBadgedRowToFlat(row))
      }

      logger.info({ action: 'anime-badged', dbMs: Math.round(dbMs), rows: results.length })
      return c.json(result)
    }
  )
}
