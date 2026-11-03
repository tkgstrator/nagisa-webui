/**
 * AniList GraphQL API から年単位で anime media を取得する pure HTTP 層。
 *
 * DB アクセスや side-effect は持たず、入力 (year/page/country) → 出力 (entries) のみ。
 * scripts (bun:sqlite) と Workers Queue consumer (Prisma) の両方から再利用される。
 */
const ANILIST_API = 'https://graphql.anilist.co'
const PER_PAGE = 50

const MEDIA_FIELDS = `
      id
      title { native romaji english }
      countryOfOrigin
      season
      seasonYear
      status
      startDate { year month }
      endDate { year month day }
      episodes
      nextAiringEpisode { airingAt episode }`

export const ANILIST_QUERY = `query ($year: Int, $page: Int, $perPage: Int, $country: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, seasonYear: $year, countryOfOrigin: $country) {${MEDIA_FIELDS}
    }
  }
}`

/** id_in で指定した media だけを取る。年・国に依存しないので seasonYear null / 非 JP も拾える */
export const ANILIST_BY_IDS_QUERY = `query ($ids: [Int], $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, id_in: $ids) {${MEDIA_FIELDS}
    }
  }
}`

/** id_in 1 回の上限 (1 ページ = PER_PAGE 件) */
export const ANILIST_IDS_CHUNK = PER_PAGE

export interface AniListEntry {
  id: number
  title: { native: string | null; romaji: string | null; english: string | null }
  /** 古い Lambda image では欠落する */
  countryOfOrigin?: string | null
  season: string | null
  seasonYear: number | null
  status: string | null
  startDate: { year: number | null; month: number | null }
  endDate?: { year: number | null; month: number | null; day: number | null } | null
  episodes?: number | null
  /** airingAt は UNIX 秒 */
  nextAiringEpisode?: { airingAt: number; episode: number } | null
}

export interface FetchPageResult {
  hasNextPage: boolean
  media: AniListEntry[]
}

async function postAnilist(query: string, variables: Record<string, unknown>, retries = 3): Promise<FetchPageResult> {
  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  })

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '5')
    await new Promise((r) => setTimeout(r, retryAfter * 1000))
    return postAnilist(query, variables, retries - 1)
  }
  if (!res.ok) {
    throw new Error(`AniList ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const json = (await res.json()) as {
    data?: { Page: { pageInfo: { hasNextPage: boolean }; media: AniListEntry[] } }
    errors?: unknown
  }
  if (!json.data) throw new Error(`AniList error: ${JSON.stringify(json.errors)}`)
  return { hasNextPage: json.data.Page.pageInfo.hasNextPage, media: json.data.Page.media }
}

/** AniList Page クエリを 1 回叩く。429 は Retry-After を見て自動リトライ */
export function fetchAnilistYearPage(year: number, page: number, country: string): Promise<FetchPageResult> {
  return postAnilist(ANILIST_QUERY, { year, page, perPage: PER_PAGE, country })
}

/** id_in で最大 ANILIST_IDS_CHUNK 件をまとめて取る (1 ページに収まる) */
export function fetchAnilistByIds(ids: number[]): Promise<FetchPageResult> {
  return postAnilist(ANILIST_BY_IDS_QUERY, { ids, page: 1, perPage: PER_PAGE })
}
