import { afterEach, describe, expect, test } from 'bun:test'
import { fetchAnilistYear } from './anilist-year'
import { UpstreamError } from '../response'
import { FetchAnilistYearRequestSchema, FetchAnilistYearResponseSchema } from '../../../src/schemas/lambda.dto'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const entry = (id: number) => ({
  id,
  title: { native: `t${id}`, romaji: null, english: null },
  season: 'SPRING',
  seasonYear: 2026,
  status: 'RELEASING',
  startDate: { year: 2026, month: 4 }
})

const mockFetch = (responses: Response[]) => {
  const queue = [...responses]
  globalThis.fetch = (async () => queue.shift() ?? new Response('exhausted', { status: 500 })) as unknown as typeof fetch
}

const page = (ids: number[], hasNextPage: boolean) =>
  new Response(JSON.stringify({ data: { Page: { pageInfo: { hasNextPage }, media: ids.map(entry) } } }))

describe('/anilist_year handler', () => {
  test('request defaults', () => {
    const req = FetchAnilistYearRequestSchema.parse({ year: 2026 })
    expect(req).toEqual({ year: 2026, country: 'JP', startPage: 1, maxPages: 5 })
  })

  test('returns nextPage when maxPages reached', async () => {
    mockFetch([page([1], true)])
    const res = await fetchAnilistYear({ year: 2026, country: 'JP', startPage: 1, maxPages: 1 })
    expect(res.nextPage).toBe(2)
    expect(res.entries).toHaveLength(1)
    expect(FetchAnilistYearResponseSchema.safeParse(res).success).toBe(true)
  })

  test('nextPage is null when the year is exhausted', async () => {
    mockFetch([page([1, 2], false)])
    const res = await fetchAnilistYear({ year: 2026, country: 'JP', startPage: 3, maxPages: 5 })
    expect(res).toMatchObject({ pages: 1, nextPage: null })
    expect(res.entries).toHaveLength(2)
  })

  test('403 becomes UpstreamError with status', async () => {
    mockFetch([new Response('You have been manually blocked', { status: 403 })])
    const err = await fetchAnilistYear({ year: 2026, country: 'JP', startPage: 1, maxPages: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(UpstreamError)
    expect((err as UpstreamError).status).toBe(403)
    expect((err as UpstreamError).message).toContain('AniList 403')
  })
})
