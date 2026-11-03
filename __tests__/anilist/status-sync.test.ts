import { describe, expect, test } from 'bun:test'
import { airingColumns, syncAnilistMediaStatus } from '../../src/lib/metadata/anilist-sync'

const base = {
  id: 1,
  title: { native: 'あ', romaji: null, english: null },
  season: null,
  seasonYear: null,
  status: 'FINISHED',
  startDate: { year: 2026, month: 4 }
}

describe('airingColumns', () => {
  test('未取得 (undefined) は列を触らない', () => {
    expect(airingColumns(base)).toEqual({})
  })
  test('null は null で上書き、値は変換する', () => {
    expect(airingColumns({ ...base, endDate: null, episodes: null, nextAiringEpisode: null })).toEqual({
      endYear: null,
      endMonth: null,
      endDay: null,
      episodes: null,
      nextAiringAt: null,
      nextAiringEpisode: null
    })
    const c = airingColumns({
      ...base,
      endDate: { year: 2026, month: 6, day: 30 },
      episodes: 12,
      nextAiringEpisode: { airingAt: 1_780_000_000, episode: 12 }
    })
    expect(c.endDay).toBe(30)
    expect(c.nextAiringAt).toEqual(new Date(1_780_000_000_000))
    expect(c.nextAiringEpisode).toBe(12)
  })
})

describe('syncAnilistMediaStatus', () => {
  test('既存行を updateMany で更新し country は書かない', async () => {
    const calls: { where: unknown; data: Record<string, unknown> }[] = []
    const prisma = { anilistMedia: { updateMany: async (a: (typeof calls)[number]) => void calls.push(a) } }
    const lambda = { fetchAnilistStatus: async () => ({ entries: [{ ...base, seasonYear: null }] }) }
    // biome-ignore lint/suspicious/noExplicitAny: 最小モック
    const r = await syncAnilistMediaStatus({ prisma: prisma as any, lambda, ids: [1, 2] })
    expect(r).toEqual({ requested: 2, updated: 1 })
    expect(calls[0].where).toEqual({ id: 1 })
    expect(calls[0].data.status).toBe('FINISHED')
    expect('countryOfOrigin' in calls[0].data).toBe(false)
  })
})
