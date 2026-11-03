import {
  buildImageUrl,
  type GenreCard,
  GenreCardSchema,
  GenreCardsResponseSchema
} from '../../../schemas/providers/abema.dto'
import type { Title } from '../../../schemas/providers/common.dto'
import { getAppLogger } from '../../logger'
import { getAccessToken } from './auth'

const logger = getAppLogger('abema')

export async function abemaGet(url: string, params: Record<string, string>): Promise<unknown> {
  const token = await getAccessToken()
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v)
  }
  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Referer: 'https://abema.tv/'
    }
  })
  if (!res.ok) {
    throw new Error(`ABEMA API error: ${res.status} ${res.statusText} (${u.pathname})`)
  }
  return res.json()
}

export function cardToTitle(card: GenreCard): Title {
  const thumb = card.thumbComponent
  const imageUrl = thumb ? buildImageUrl(thumb) : 'https://abema.tv/favicon.ico'

  return {
    contentId: card.seriesId,
    title: card.title,
    description: card.title,
    entityType: 'tv',
    imageUrl,
    maturityRating: null,
    nextEpisodeDate: undefined,
    badge: undefined
  }
}

/** cards 配列を 1 件ずつ検証し、不正なカードはスキップする。全体は落とさない */
export function parseCards(rawCards: unknown[]): { cards: GenreCard[]; skipped: number } {
  const parsed = rawCards.flatMap((c) => {
    const r = GenreCardSchema.safeParse(c)
    return r.success ? [r.data] : []
  })
  return { cards: parsed, skipped: rawCards.length - parsed.length }
}

const GENRE_CARDS_BASE = 'https://api.p-c3-e.abema-tv.com/v1/video/featureGenres'
const ROOT_GENRE = 'animation'
/** ABEMA 429 対策としてサブジャンル取得の同時数を絞る */
const SUBGENRE_CONCURRENCY = 4

export type GenrePage = { cards: unknown[]; next: string | undefined; subGenreIds: string[] }
export type GenrePageFetcher = (genreId: string, next: string | undefined) => Promise<GenrePage>

/** seriesId で重複排除する。先に現れたものを残す（animation 本体 → サブジャンル順） */
export function mergeCardLists(lists: GenreCard[][]): GenreCard[] {
  const merged = lists
    .flat()
    .reduce((acc, card) => (acc.has(card.seriesId) ? acc : acc.set(card.seriesId, card)), new Map<string, GenreCard>())
  return [...merged.values()]
}

async function fetchGenrePage(genreId: string, next: string | undefined): Promise<GenrePage> {
  const params: Record<string, string> = { limit: '20', onlyFree: 'false' }
  if (next) params.next = next
  const raw = await abemaGet(`${GENRE_CARDS_BASE}/${genreId}/cards`, params)
  const result = GenreCardsResponseSchema.safeParse(raw)
  if (!result.success) throw result.error
  return {
    cards: result.data.cards,
    next: result.data.paging?.next,
    subGenreIds: (result.data.genre?.subGenres ?? []).map((g) => g.id)
  }
}

/** 1 ジャンルを最後のページまで辿る。subGenreIds は先頭ページのものを返す */
async function fetchGenre(
  genreId: string,
  getPage: GenrePageFetcher
): Promise<{ cards: GenreCard[]; skipped: number; subGenreIds: string[] }> {
  const acc = { cards: [] as GenreCard[], skipped: 0, subGenreIds: [] as string[] }
  const cursor: { next: string | undefined; first: boolean } = { next: undefined, first: true }
  do {
    const page = await getPage(genreId, cursor.next)
    const { cards, skipped } = parseCards(page.cards)
    acc.cards.push(...cards)
    acc.skipped += skipped
    if (cursor.first) acc.subGenreIds = page.subGenreIds
    cursor.first = false
    cursor.next = page.next
  } while (cursor.next)
  return acc
}

/** 並列数を制限して順序を保ったまま map する。各要素の失敗は結果に畳む */
async function mapSettled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  const cursor = { i: 0 }
  const worker = async () => {
    while (cursor.i < items.length) {
      const idx = cursor.i++
      const item = items[idx] as T
      results[idx] = await fn(item).then(
        (value): PromiseFulfilledResult<R> => ({ status: 'fulfilled', value }),
        (reason): PromiseRejectedResult => ({ status: 'rejected', reason })
      )
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function fetchCardsWith(
  getPage: GenrePageFetcher,
  concurrency = SUBGENRE_CONCURRENCY
): Promise<GenreCard[]> {
  // animation 本体の失敗はそのまま throw
  const root = await fetchGenre(ROOT_GENRE, getPage)
  const subIds = [...new Set(root.subGenreIds)].filter((id) => id !== ROOT_GENRE)
  const subResults = await mapSettled(subIds, concurrency, (id) => fetchGenre(id, getPage))

  const subs = subResults.flatMap((r, i) => {
    if (r.status === 'fulfilled') return [r.value]
    logger.warn({ action: 'subgenre-fetch-failed', genre: subIds[i], error: String(r.reason) })
    return []
  })

  const skipped = root.skipped + subs.reduce((n, s) => n + s.skipped, 0)
  const allCards = mergeCardLists([root.cards, ...subs.map((s) => s.cards)])

  if (skipped > 0) {
    logger.warn({ action: 'skip-invalid-cards', skipped, valid: allCards.length })
  }
  // 0 件は API 仕様変更の可能性が高い。成功扱いにすると badge リセットなどが全件に走るので失敗にする
  if (allCards.length === 0) {
    throw new Error('ABEMA cards: 0 valid cards (API response shape may have changed)')
  }
  return allCards
}

export function fetchCards(): Promise<GenreCard[]> {
  return fetchCardsWith(fetchGenrePage)
}
