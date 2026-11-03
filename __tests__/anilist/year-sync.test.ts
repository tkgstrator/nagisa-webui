import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { syncAnilistMediaYear } from '../../src/lib/metadata/anilist-sync'

const entry = (id: number) => ({
  id,
  title: { native: `タイトル${id}`, romaji: null, english: null },
  season: 'SPRING',
  seasonYear: 2026,
  status: 'RELEASING',
  startDate: { year: 2026, month: 4 }
})

const fakePrisma = (ids: number[]) =>
  ({
    anilistMedia: { upsert: async ({ where }: { where: { id: number } }) => void ids.push(where.id) }
  }) as unknown as PrismaClient

describe('syncAnilistMediaYear (via Lambda)', () => {
  test('follows nextPage until the year is exhausted and upserts every entry', async () => {
    const upserted: number[] = []
    const startPages: number[] = []
    const chunks = [
      { entries: [entry(1), entry(2)], pages: 5, nextPage: 6 },
      { entries: [entry(3)], pages: 2, nextPage: null }
    ]
    const lambda = {
      fetchAnilistYear: async ({ startPage }: { startPage?: number }) => {
        startPages.push(startPage ?? 1)
        return chunks[startPages.length - 1]
      }
    }
    const r = await syncAnilistMediaYear({ prisma: fakePrisma(upserted), lambda, year: 2026 })
    expect(startPages).toEqual([1, 6])
    expect(upserted).toEqual([1, 2, 3])
    expect(r).toMatchObject({ year: 2026, fetched: 3, pages: 7 })
  })

  test('propagates Lambda errors so the queue can fail the message', async () => {
    const lambda = {
      fetchAnilistYear: async () => {
        throw new Error('Lambda invocation failed: 403 AniList 403')
      }
    }
    await expect(syncAnilistMediaYear({ prisma: fakePrisma([]), lambda, year: 2026 })).rejects.toThrow('403')
  })
})
