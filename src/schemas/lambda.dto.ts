import { z } from 'zod'
import { TitleSchema, TitleStatusTypeEnum } from './providers/common.dto'

// ---- リクエスト ----

export const ProviderSchema = z.enum(['amazon', 'hulu', 'crunchyroll', 'abema'])

export const FetchExpiringRequestSchema = z.object({
  provider: ProviderSchema
})

export const TitleListCategorySchema = z.enum(['new_episode', 'coming_soon', 'catalog'])

export const FetchTitleListRequestSchema = z.object({
  provider: ProviderSchema,
  category: TitleListCategorySchema
})

// ---- レスポンス ----

export const ExpiringEntrySchema = z.object({
  contentId: z.string().nonempty(),
  expiredAt: z.iso.datetime(),
  expiringSeason: z.number().nullable()
})

export const ExpiringResponseSchema = z.object({
  fetchedAt: z.iso.datetime(),
  entries: z.array(ExpiringEntrySchema)
})
export type ExpiringResponse = z.infer<typeof ExpiringResponseSchema>

export const TitleListEntrySchema = TitleSchema.omit({ expiring: true })

export const TitleListResponseSchema = z.object({
  fetchedAt: z.iso.datetime(),
  entries: z.array(TitleListEntrySchema)
})
export type TitleListResponse = z.infer<typeof TitleListResponseSchema>

export const FetchTitleInfoRequestSchema = z.object({
  provider: z.string().nonempty(),
  contentId: z.string().nonempty()
})

export const FetchAbemaArchiveRequestSchema = z.object({
  programIds: z.array(z.string().nonempty()).min(1).max(20),
  targetHeight: z.number().int().positive().max(2160).optional()
})

export const AbemaArchiveRecordSchema = z.object({
  programId: z.string().nonempty(),
  cid: z.string().nonempty(),
  contentKeyHex: z.string().length(32),
  ivHex: z.string().length(32),
  variantUrl: z.string().nonempty(),
  variantResolution: z.string().nonempty(),
  variantBandwidth: z.number().int().nonnegative(),
  segmentUrls: z.array(z.string().nonempty())
})

export const AbemaArchiveResultEntrySchema = z.object({
  programId: z.string().nonempty(),
  ok: z.boolean(),
  archive: AbemaArchiveRecordSchema.optional(),
  error: z.string().optional()
})

export const FetchAbemaArchiveResponseSchema = z.object({
  results: z.array(AbemaArchiveResultEntrySchema)
})

// ---- identify ----

export const IdentifyResultSchema = z
  .object({
    aniListId: z.number().int().optional(),
    title: z.string().nonempty(),
    status: TitleStatusTypeEnum,
    year: z.number().int(),
    quarter: z.number().int()
  })
  .nullable()

export const IdentifyResponseSchema = z.object({
  results: z.array(IdentifyResultSchema)
})

export const IdentifyRequestSchema = z.object({
  titles: z.array(z.string().nonempty()).max(50)
})

// ---- anilist_year ----

const AnilistNullableString = z.string().nullable()

export const AnilistYearEntrySchema = z.object({
  id: z.number().int(),
  title: z.object({
    native: AnilistNullableString,
    romaji: AnilistNullableString,
    english: AnilistNullableString
  }),
  season: AnilistNullableString,
  seasonYear: z.number().int().nullable(),
  status: AnilistNullableString,
  startDate: z.object({ year: z.number().int().nullable(), month: z.number().int().nullable() }),
  countryOfOrigin: z.string().nullish(),
  // 以下は Lambda が古い image のままでも Worker が壊れないよう optional。
  // 欠落 (undefined) は「取得していない」なので upsert では列を触らない。null は「AniList が持たない」。
  endDate: z
    .object({ year: z.number().int().nullable(), month: z.number().int().nullable(), day: z.number().int().nullable() })
    .nullish(),
  episodes: z.number().int().nullish(),
  nextAiringEpisode: z.object({ airingAt: z.number().int(), episode: z.number().int() }).nullish()
})

/** 1 回の呼び出しで取得するページ数の上限。1 ページ約 1.5s なので Lambda のタイムアウトに収まる範囲に抑える */
export const ANILIST_YEAR_MAX_PAGES = 10

export const FetchAnilistYearRequestSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  country: z.string().length(2).default('JP'),
  /** 取得開始ページ (1 始まり)。前回レスポンスの nextPage を渡して続きを取る */
  startPage: z.number().int().min(1).default(1),
  maxPages: z.number().int().min(1).max(ANILIST_YEAR_MAX_PAGES).default(5)
})

export const FetchAnilistYearResponseSchema = z.object({
  entries: z.array(AnilistYearEntrySchema),
  pages: z.number().int(),
  /** 続きがあれば次に取得すべきページ番号、年内を取り切ったら null */
  nextPage: z.number().int().nullable()
})

// ---- anilist_status ----

/** id_in 1 回の上限。AniList の perPage 上限 50 に合わせる */
export const ANILIST_STATUS_MAX_IDS = 50

export const FetchAnilistStatusRequestSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(ANILIST_STATUS_MAX_IDS)
})

export const FetchAnilistStatusResponseSchema = z.object({
  entries: z.array(AnilistYearEntrySchema)
})

// ---- image ----

export const FetchImageRequestSchema = z.object({
  provider: z.string().nonempty(),
  urls: z.array(z.url()).min(1).max(10)
})

export const FetchImageResultSchema = z.object({
  url: z.url(),
  /** 幅 (文字列) -> WebP の base64。取得か変換に失敗した URL は null */
  widths: z.record(z.string(), z.string()).nullable(),
  error: z.string().optional()
})

export const FetchImageResponseSchema = z.object({
  results: z.array(FetchImageResultSchema)
})
