import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { fetchTitleList } from '../../src/lib/sync/catalog'
import { ensureAnilistMedia } from '../../src/lib/sync/ensure-media'
import { reidentifyUnidentified } from '../../src/lib/sync/reidentify'
import type { TitleListResponse } from '../../src/schemas/lambda.dto.ts'

const entry = (id: number, countryOfOrigin?: string) => ({
  id,
  countryOfOrigin,
  title: { native: `t${id}`, romaji: null, english: null },
  season: null,
  seasonYear: null,
  status: 'RELEASING',
  startDate: { year: 2026, month: 7 }
})

function makePrisma(existingMedia: number[]) {
  const upserts: { id: number; country: string }[] = []
  const createdAnime: { contentId: string; aniListId: number }[] = []
  const unidentified: string[] = []
  const deleted: string[] = []
  const prisma = {
    anilistMedia: {
      findMany: async ({ where }: { where?: { id?: { in: number[] } } }) =>
        (where?.id?.in ?? []).filter((id) => existingMedia.includes(id)).map((id) => ({ id })),
      upsert: async ({ where, create }: { where: { id: number }; create: { countryOfOrigin: string } }) => {
        upserts.push({ id: where.id, country: create.countryOfOrigin })
      }
    },
    anime: {
      findMany: async () => [],
      create: async ({ data }: { data: { id: string; contentId: string; aniListId: number } }) => {
        createdAnime.push({ contentId: data.contentId, aniListId: data.aniListId })
        return { id: data.id }
      }
    },
    unidentifiedAnime: {
      findMany: async () => [],
      upsert: async ({ where }: { where: { provider_contentId: { contentId: string } } }) => {
        unidentified.push(where.provider_contentId.contentId)
      },
      deleteMany: async ({ where }: { where: { contentId: string } }) => {
        deleted.push(where.contentId)
      }
    },
    catalogEvent: { createMany: async () => ({ count: 1 }), create: async () => ({}) }
  } as unknown as PrismaClient
  return { prisma, upserts, createdAnime, unidentified, deleted }
}

describe('ensureAnilistMedia', () => {
  test('fetches only missing ids and follows the fetched countryOfOrigin', async () => {
    const { prisma, upserts } = makePrisma([1])
    const requested: number[][] = []
    const lambda = {
      fetchAnilistStatus: async ({ ids }: { ids: number[] }) => {
        requested.push(ids)
        return { entries: ids.filter((i) => i !== 3).map((i) => entry(i, i === 2 ? 'KR' : undefined)) }
      }
    }
    const ok = await ensureAnilistMedia(prisma, lambda, [1, 2, 3])
    expect(requested).toEqual([[2, 3]])
    expect(upserts).toEqual([{ id: 2, country: 'KR' }])
    expect([...ok].sort()).toEqual([1, 2])
  })

  test('lambda failure leaves ids unavailable without throwing', async () => {
    const { prisma } = makePrisma([])
    const lambda = {
      fetchAnilistStatus: async () => {
        throw new Error('boom')
      }
    }
    expect((await ensureAnilistMedia(prisma, lambda, [5])).size).toBe(0)
  })
})

const titles = (...ids: string[]) =>
  ({
    entries: ids.map((contentId) => ({
      contentId,
      title: contentId,
      description: '',
      entityType: 'tv',
      imageUrl: null,
      badge: null,
      nextEpisodeDate: null
    }))
  }) as unknown as TitleListResponse

describe('fetchTitleList: Lambda 識別でも anilist_media を先に保証する', () => {
  test('anime is created only when the media row could be fetched', async () => {
    const { prisma, upserts, createdAnime, unidentified } = makePrisma([])
    const lambda = {
      identifyTitles: async (body: { titles: string[] }) => ({
        results: body.titles.map((t, i) => ({
          aniListId: 100 + i,
          title: t,
          status: 'RELEASING' as const,
          year: 2026,
          quarter: 3
        }))
      }),
      fetchAnilistStatus: async ({ ids }: { ids: number[] }) => ({
        entries: ids.filter((i) => i === 100).map((i) => entry(i))
      })
    }
    const ids = await fetchTitleList(prisma, 'abema', 'new_episode', titles('ok', 'ng'), lambda)
    expect(upserts.map((u) => u.id)).toEqual([100])
    expect(createdAnime).toEqual([{ contentId: 'ok', aniListId: 100 }])
    expect(unidentified).toEqual(['ng'])
    expect(ids).toEqual(['ok'])
  })
})

describe('reidentifyUnidentified: 取得できなかった id は昇格しない', () => {
  test('keeps the row unidentified', async () => {
    const { prisma, createdAnime, deleted } = makePrisma([])
    const rows = [{ id: 'r1', provider: 'hulu', contentId: 'c1', title: 'x', imageUrl: null }]
    ;(prisma as unknown as { unidentifiedAnime: { findMany: () => Promise<typeof rows> } }).unidentifiedAnime.findMany =
      async () => rows
    const lambda = {
      identifyTitles: async () => ({
        results: [{ aniListId: 9, title: 'x', status: 'RELEASING' as const, year: 2026, quarter: 3 }]
      }),
      fetchAnilistStatus: async () => ({ entries: [] })
    } as unknown as Parameters<typeof reidentifyUnidentified>[1]
    const r = await reidentifyUnidentified(prisma, lambda, { limit: 5 })
    expect(createdAnime).toEqual([])
    expect(deleted).toEqual([])
    expect(r.promoted).toEqual([])
  })
})
