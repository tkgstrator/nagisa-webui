import { describe, expect, test } from 'bun:test'
import { buildDirtyWrite, JELLYFIN_STATE_KEY } from '../../src/lib/jellyfin/dirty'
import { matchKey } from '../../src/lib/library-sync/ledger'
import { hasNewCompleted } from '../../src/lib/library-sync/new-completed'
import { createTestDb } from './harness'

type Prisma = Parameters<typeof hasNewCompleted>[0]

const row = (recordingId: string, episodeId: string) => ({
  recordingId,
  item: {
    provider: 'hulu',
    content_id: 'c1',
    episode_id: episodeId,
    season_number: 1,
    episode_number: 1,
    path: 'a/b.mkv',
    size: 1,
    mtime: null
  }
})
const resolved = (...pairs: [string, string][]) => new Map(pairs.map(([ep, id]) => [matchKey('hulu', 'c1', ep), [id]]))

/** completed な既存行だけを返す findMany の代役 */
const prismaWith = (completed: { id: string; recordingId: string | null }[]) =>
  ({ episode: { findMany: async () => completed } }) as unknown as Prisma

describe('hasNewCompleted', () => {
  test('まだ completed でない話が入れば true', async () => {
    expect(await hasNewCompleted(prismaWith([]), [row('r1', 'e1')], resolved(['e1', 'id1']))).toBe(true)
  })
  test('同じ録画の再走査 (パス・容量の更新) は false', async () => {
    expect(
      await hasNewCompleted(prismaWith([{ id: 'id1', recordingId: 'r1' }]), [row('r1', 'e1')], resolved(['e1', 'id1']))
    ).toBe(false)
  })
  test('別の録画で上書きされる (録り直し) は true', async () => {
    expect(
      await hasNewCompleted(prismaWith([{ id: 'id1', recordingId: 'old' }]), [row('r2', 'e1')], resolved(['e1', 'id1']))
    ).toBe(true)
  })
  test('どのエピソードにも当たらない (unmatched) は false', async () => {
    expect(await hasNewCompleted(prismaWith([]), [row('r1', 'e1')], new Map())).toBe(false)
  })
})

describe('buildDirtyWrite', () => {
  const now = new Date('2026-11-02T00:00:00.000Z')
  const run = async (db: D1Database, owner: string) => {
    const w = buildDirtyWrite(owner, now)
    return (
      await db
        .prepare(w.sql)
        .bind(...w.values)
        .run()
    ).meta.changes
  }

  test('lease を持つ run だけが dirty を立て、generation を進め、起点は据え置く', async () => {
    const { db, prisma, close } = await createTestDb()
    try {
      await prisma.jellyfinRefreshState.create({ data: { key: JELLYFIN_STATE_KEY } })
      await prisma.syncState.create({
        data: { key: 'library', leaseOwner: 'me', leaseUntil: new Date(now.getTime() + 60_000) }
      })
      expect(await run(db, 'someone-else')).toBe(0)
      expect(
        (await prisma.jellyfinRefreshState.findUniqueOrThrow({ where: { key: JELLYFIN_STATE_KEY } })).dirtySince
      ).toBeNull()

      expect(await run(db, 'me')).toBe(1)
      const first = await prisma.jellyfinRefreshState.findUniqueOrThrow({ where: { key: JELLYFIN_STATE_KEY } })
      expect(first.dirtyGeneration).toBe(1)
      expect(first.dirtySince).toEqual(now)

      expect(await run(db, 'me')).toBe(1)
      const second = await prisma.jellyfinRefreshState.findUniqueOrThrow({ where: { key: JELLYFIN_STATE_KEY } })
      expect(second.dirtyGeneration).toBe(2)
      expect(second.dirtySince).toEqual(first.dirtySince)
    } finally {
      close()
    }
  })
})
