import { z } from 'zod'
import { RecordStatusEnum } from './recording.dto'

export const AnimeSchema = z.object({
  id: z.uuid(),
  title: z.string().nonempty(),
  description: z
    .string()
    .nonempty()
    .transform((s) => s.replace(/©.*/s, '').trim()),
  provider: z.string().nonempty(),
  contentId: z.string().nonempty(),
  entityType: z.string().nonempty(),
  maturityRating: z.number().int().nonnegative().nullable(),
  imageUrl: z.url(),
  year: z.number().int(),
  quarter: z.number().int().min(0).max(3),
  status: z.string(),
  aniListId: z.number().int(),
  badge: z.string().nullable(),
  nextEpisodeDate: z.coerce.string().nullable(),
  expiredAt: z.coerce.string().nullable(),
  expiringSeason: z.number().int().positive().nullable(),
  scheduled: z.coerce.boolean(),
  recorded: z.coerce.boolean(),
  createdAt: z.coerce.string().nonempty(),
  updatedAt: z.coerce.string().nonempty()
})
export type AnimeSchema = z.infer<typeof AnimeSchema>

export const AnimeInfoSchema = AnimeSchema.extend({
  seasons: z.array(
    z.object({
      id: z.uuid(),
      seasonId: z.string().nonempty(),
      displayName: z.string().nonempty(),
      seasonNumber: z.number().int().nonnegative(),
      episodes: z.array(
        z.object({
          id: z.uuid(),
          episodeNumber: z.number().int().nonnegative(),
          episodeId: z.string().nonempty(),
          title: z.string().nonempty(),
          description: z.string().nonempty(),
          releaseDate: z.coerce.string().nonempty(),
          duration: z.number().int().nonnegative(),
          maturityRating: z.number().int().nonnegative().nullable(),
          imageUrl: z.string().nonempty(),
          hasSubtitles: z.coerce.boolean(),
          hasDub: z.coerce.boolean(),
          benefitId: z.string().nonempty(),
          recorded: z.coerce.boolean(),
          /** 録画指示の進み具合。未知の値が来ても画面を落とさない */
          recordStatus: RecordStatusEnum.catch('none'),
          recordError: z.string().nullable().catch(null),
          hasLocalKey: z.coerce.boolean()
        })
      )
    })
  )
})
export type AnimeInfoSchema = z.infer<typeof AnimeInfoSchema>

export const QuarterLabel: Record<number, string> = {
  0: '冬',
  1: '春',
  2: '夏',
  3: '秋'
}

export const AnimeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  provider: z.string().nonempty().optional(),
  year: z.coerce.number().int().optional(),
  quarter: z.coerce.number().int().min(0).max(3).optional(),
  status: z.string().nonempty().optional(),
  /** この放送状態の作品を除く。AniList の紐付けが無い作品は残す。 */
  excludeStatus: z.string().nonempty().optional(),
  scheduled: z.coerce.boolean().optional(),
  recorded: z.coerce.boolean().optional(),
  badge: z.string().nonempty().optional(),
  aniListId: z.coerce.number().int().optional(),
  sort: z.enum(['title', 'year', 'updatedAt']).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().nonempty().optional()
})
export type AnimeListQuerySchema = z.infer<typeof AnimeListQuerySchema>

export const BadgedAnimeSchema = z.object({
  NEW_EPISODE: z.array(AnimeSchema),
  RECENTLY_ADDED: z.array(AnimeSchema),
  COMING_SOON: z.array(AnimeSchema),
  EXPIRING: z.array(AnimeSchema)
})
export type BadgedAnimeSchema = z.infer<typeof BadgedAnimeSchema>

export const PaginatedAnimeSchema = z.object({
  data: z.array(AnimeSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int()
})
export type PaginatedAnimeSchema = z.infer<typeof PaginatedAnimeSchema>

/**
 * `POST /anime/:id/record` の body。省略時は未録画の回をすべて送る。
 * 指定時は録画済みの回でも送る (nagisa 側が既にあるファイルを飛ばす)。
 */
export const RecordAnimeRequestSchema = z
  .object({ episodeIds: z.array(z.string().nonempty()).nonempty().optional() })
  .optional()
export type RecordAnimeRequest = z.infer<typeof RecordAnimeRequestSchema>

/** 録画状態の同期結果。nagisa の設定が無い環境でも refresh 自体は通すので、失敗は error に畳む。 */
export const RefreshAnimeResponseSchema = z.object({
  contentId: z.string(),
  provider: z.string(),
  sync: z.object({
    jobs: z.object({ downloading: z.number(), failed: z.number(), stale: z.number(), error: z.string().nullable() }),
    library: z.object({ skipped: z.boolean(), upserts: z.number(), deletes: z.number(), error: z.string().nullable() })
  })
})
