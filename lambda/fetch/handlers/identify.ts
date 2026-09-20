/**
 * `/identify` ハンドラ。
 * 与えられた raw タイトル文字列を cleanTitle で正規化して AniList にバッチ検索し、
 * native title / status / year / quarter を返す。
 */
import { z } from 'zod'
import { cleanTitle } from '../../../src/lib/metadata/anilist'
import type { IdentifyResponseSchema } from '../../../src/schemas/lambda.dto'
import type { TitleSeasonTypeEnum } from '../../../src/schemas/providers/common.dto'
import { MetadataMediaSchema } from '../../../src/schemas/providers/metadata.dto'
import { fetchWithRetry } from '../http'
import { logger } from '../logger'
import { UpstreamError } from '../response'

/** `/identify` のレスポンス型。`IdentifyResponseSchema` (lambda.dto) から導出する。 */
type IdentifyResponse = z.infer<typeof IdentifyResponseSchema>

/** AniList の season 値 (WINTER / SPRING / SUMMER / FALL)。 */
type TitleSeason = z.infer<typeof TitleSeasonTypeEnum>

/** AniList GraphQL エンドポイント。 */
const ANILIST_API = 'https://graphql.anilist.co'

/** AniList GraphQL の Media から取得したいフィールド。 */
const MEDIA_FIELDS = `
  id
  title { native }
  countryOfOrigin
  status
  season
  seasonYear
  startDate { year month day }
`

/**
 * AniList バッチ検索レスポンスの envelope。
 * `data.q<i>` に各検索の Page が入る。media 要素の検証は個別に {@link MetadataMediaSchema} で行うので
 * ここでは unknown のまま通す。GraphQL errors で Page 単位が null になるケースは許容し、
 * `data` 自体が欠ける / null のケースは schema 不一致として扱う。
 */
const AniListBatchResponseSchema = z.object({
  data: z.record(z.string(), z.object({ media: z.array(z.unknown()).nullish() }).nullish())
})

/** AniList season → 四半期 (0..3) 変換テーブル。WINTER=Q1, SPRING=Q2, SUMMER=Q3, FALL=Q4。 */
const SEASON_TO_QUARTER: Record<TitleSeason, number> = {
  WINTER: 0,
  SPRING: 1,
  SUMMER: 2,
  FALL: 3
}

/** startDate.month (1..12) → 四半期 (0..3) 変換テーブル。season が空の場合の fallback。 */
const MONTH_TO_QUARTER = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] as const

/**
 * 複数タイトルの AniList 検索を 1 リクエストにバッチする GraphQL クエリを構築する。
 * `q0` .. `qN-1` の alias に各検索が結び付く。
 */
function buildBatchQuery(searches: string[]): string {
  const fragments = searches.map(
    (search, i) =>
      `q${i}: Page(perPage: 5) { media(search: ${JSON.stringify(search)}, type: ANIME) { ${MEDIA_FIELDS} } }`
  )
  return `query { ${fragments.join('\n')} }`
}

/**
 * AniList でタイトルを検索し、native title / status / year / quarter を返す。
 * ヒット無し・schema 不一致・year/quarter 特定不可の要素は null で返す。
 *
 * @param rawTitles  検索対象の raw title 文字列。cleanTitle で正規化してから検索する。
 * @returns 入力順の results
 * @throws {UpstreamError} AniList が 4xx/5xx を返した場合 (handleRoute が 502 化する)
 * @throws {Error} AniList の 200 応答が期待する envelope 形状でない場合 (500 化される)
 */
export async function identifyTitles(rawTitles: string[]): Promise<IdentifyResponse> {
  if (rawTitles.length === 0) return { results: [] }

  const searches = rawTitles.map((t) => cleanTitle(t))
  const query = buildBatchQuery(searches)

  const res = await fetchWithRetry(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query })
  })

  if (!res.ok) {
    logger.error({ action: 'anilist-error', status: res.status })
    throw new UpstreamError(res.status, `AniList API error: ${res.status}`)
  }

  const envelope = AniListBatchResponseSchema.safeParse(await res.json())
  if (!envelope.success) {
    logger.error({ action: 'anilist-envelope-mismatch', error: envelope.error.message })
    throw new Error(`AniList response schema mismatch: ${envelope.error.message}`)
  }

  const results = searches.map((_, i) => {
    const page = envelope.data.data[`q${i}`]
    if (!page?.media?.length) return null
    const parsed = MetadataMediaSchema.safeParse(page.media[0])
    if (!parsed.success) {
      logger.warn({ action: 'identify-schema-mismatch', index: i, error: parsed.error.message })
      return null
    }
    const media = parsed.data

    const year = media.seasonYear ?? media.startDate.year
    const quarter = media.season
      ? SEASON_TO_QUARTER[media.season]
      : media.startDate.month
        ? MONTH_TO_QUARTER[media.startDate.month - 1]
        : null
    if (year == null || quarter == null) return null

    return {
      aniListId: media.id,
      title: media.title.native,
      status: media.status,
      year,
      quarter
    }
  })

  logger.info({
    action: 'identify',
    total: rawTitles.length,
    matched: results.filter(Boolean).length
  })
  return { results }
}
