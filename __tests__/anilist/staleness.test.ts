import { afterEach, describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { notifyIfAnilistStale } from '../../src/lib/metadata/anilist-staleness'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const prismaWith = (syncedAt: Date | null) =>
  ({ anilistMedia: { aggregate: async () => ({ _max: { syncedAt } }) } }) as unknown as PrismaClient

const now = new Date('2026-11-03T00:00:00Z')

describe('notifyIfAnilistStale', () => {
  test('recent sync -> no notification', async () => {
    const posts: unknown[] = []
    globalThis.fetch = (async (_u: unknown, init: unknown) => {
      posts.push(init)
      return new Response('{}')
    }) as unknown as typeof fetch
    expect(
      await notifyIfAnilistStale(prismaWith(new Date('2026-11-01T00:00:00Z')), 'https://example.test/hook', now)
    ).toBe(false)
    expect(posts).toHaveLength(0)
  })

  test('old sync -> notifies', async () => {
    const posts: unknown[] = []
    globalThis.fetch = (async (_u: unknown, init: unknown) => {
      posts.push(init)
      return new Response('{}')
    }) as unknown as typeof fetch
    expect(
      await notifyIfAnilistStale(prismaWith(new Date('2026-05-11T00:00:00Z')), 'https://example.test/hook', now)
    ).toBe(true)
    expect(posts).toHaveLength(1)
  })

  test('empty table counts as stale', async () => {
    globalThis.fetch = (async () => new Response('{}')) as unknown as typeof fetch
    expect(await notifyIfAnilistStale(prismaWith(null), 'https://example.test/hook', now)).toBe(true)
  })
})
