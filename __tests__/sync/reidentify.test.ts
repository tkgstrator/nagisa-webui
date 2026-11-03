import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { findKnownContentIds } from '../../src/lib/sync/queries'
import { reidentifyUnidentified } from '../../src/lib/sync/reidentify'

const entry = (id: number) => ({
  id,
  title: { native: 'x', romaji: null, english: null },
  season: null,
  seasonYear: null,
  status: 'RELEASING',
  startDate: { year: 2026, month: 7 }
})

describe('findKnownContentIds', () => {
  test('does not treat unidentified rows as known', async () => {
    const calls: string[] = []
    const prisma = {
      anime: { findMany: async () => [{ contentId: 'a' }] },
      unidentifiedAnime: {
        findMany: async () => {
          calls.push('unidentified')
          return [{ contentId: 'b' }]
        }
      }
    } as unknown as PrismaClient
    const known = await findKnownContentIds(prisma, 'abema', ['a', 'b'])
    expect([...known]).toEqual(['a'])
    expect(calls).toEqual([])
  })
})

describe('reidentifyUnidentified', () => {
  test('promotes lambda-identified rows, deletes unidentified, returns cursor', async () => {
    const created: string[] = []
    const deleted: string[] = []
    const upserted: number[] = []
    const rows = [
      { id: 'r1', provider: 'hulu', contentId: 'c1', title: 'FX戦士くるみちゃん', imageUrl: null },
      { id: 'r2', provider: 'hulu', contentId: 'c2', title: 'unknown', imageUrl: null }
    ]
    const prisma = {
      unidentifiedAnime: {
        findMany: async () => rows,
        deleteMany: async ({ where }: { where: { contentId: string } }) => {
          deleted.push(where.contentId)
        }
      },
      anilistMedia: {
        findMany: async () => [],
        upsert: async ({ where }: { where: { id: number } }) => {
          upserted.push(where.id)
        }
      },
      anime: {
        create: async ({ data }: { data: { id: string; contentId: string } }) => {
          created.push(data.contentId)
          return { id: data.id }
        }
      },
      catalogEvent: { createMany: async () => ({ count: 1 }), create: async () => ({}) }
    } as unknown as PrismaClient
    const lambda = {
      fetchAnilistStatus: async ({ ids }: { ids: number[] }) => ({ entries: ids.map(entry) }),
      identifyTitles: async (body: { titles: string[] }) => ({
        results: body.titles.map((t) =>
          t === 'FX戦士くるみちゃん'
            ? { aniListId: 206401, title: t, status: 'RELEASING', year: 2026, quarter: 3 }
            : undefined
        )
      })
    } as unknown as Parameters<typeof reidentifyUnidentified>[1]
    const r = await reidentifyUnidentified(prisma, lambda, { limit: 2 })
    expect(upserted).toEqual([206401])
    expect(created).toEqual(['c1'])
    expect(deleted).toEqual(['c1'])
    expect(r).toEqual({
      processed: 2,
      identified: 1,
      promoted: [{ provider: 'hulu', contentId: 'c1' }],
      nextCursor: 'r2'
    })
  })
})
