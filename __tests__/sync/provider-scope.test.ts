import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { findExistingContentIds } from '../../src/lib/sync/queries'

describe('findExistingContentIds', () => {
  test('provider で絞る (別プロバイダの同一 contentId を既存と見なさない)', async () => {
    const wheres: unknown[] = []
    const prisma = {
      anime: {
        findMany: async ({ where }: { where: { provider: string } }) => {
          wheres.push(where)
          return where.provider === 'hulu' ? [{ contentId: 'x' }] : []
        }
      }
    } as unknown as PrismaClient
    expect([...(await findExistingContentIds(prisma, 'hulu', ['x']))]).toEqual(['x'])
    expect([...(await findExistingContentIds(prisma, 'abema', ['x']))]).toEqual([])
    expect(wheres[0]).toEqual({ provider: 'hulu', contentId: { in: ['x'] } })
  })
})
