import { afterEach, describe, expect, test } from 'bun:test'
import { FetchAnilistStatusRequestSchema } from '../../../src/schemas/lambda.dto'
import { UpstreamError } from '../response'
import { fetchAnilistStatus } from './anilist-status'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

describe('/anilist_status handler', () => {
  test('ids は 1〜50 件', () => {
    expect(FetchAnilistStatusRequestSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(FetchAnilistStatusRequestSchema.safeParse({ ids: Array.from({ length: 51 }, (_, i) => i + 1) }).success).toBe(false)
  })
  test('id_in で問い合わせ entries を返す', async () => {
    const bodies: string[] = []
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      bodies.push(String(init?.body))
      return new Response(JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: false }, media: [{ id: 7, title: { native: 'x', romaji: null, english: null }, season: null, seasonYear: null, status: 'RELEASING', startDate: { year: null, month: null }, endDate: { year: null, month: null, day: null }, episodes: 12, nextAiringEpisode: { airingAt: 1, episode: 3 } }] } } }))
    }) as unknown as typeof fetch
    const r = await fetchAnilistStatus([7])
    expect(r.entries[0].id).toBe(7)
    expect(JSON.parse(bodies[0]).variables.ids).toEqual([7])
    expect(JSON.parse(bodies[0]).query).toContain('id_in')
  })
  test('403 は UpstreamError', async () => {
    globalThis.fetch = (async () => new Response('blocked', { status: 403 })) as unknown as typeof fetch
    await expect(fetchAnilistStatus([1])).rejects.toBeInstanceOf(UpstreamError)
  })
})
