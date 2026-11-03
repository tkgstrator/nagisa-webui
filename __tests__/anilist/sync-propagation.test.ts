import { describe, expect, test } from 'bun:test'
import type { PrismaClient } from '../../src/generated/prisma/client.ts'
import { propagateChildFailures } from '../../src/lib/sync-run'

type Row = { status: string; succeeded: number; failed: number; errorMessage: string | null }

const fakePrisma = (rows: Record<string, Row>) =>
  ({
    syncRun: {
      findUnique: async ({ where }: { where: { id: string } }) => rows[where.id] ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        rows[where.id] = { ...rows[where.id], ...data } as Row
      }
    }
  }) as unknown as PrismaClient

describe('propagateChildFailures', () => {
  test('all children failed -> parent failed', async () => {
    const rows = { p: { status: 'success', succeeded: 2, failed: 0, errorMessage: null } }
    await propagateChildFailures(fakePrisma(rows), new Map([['p', { count: 2, errorMessage: 'AniList 403' }]]))
    expect(rows.p).toMatchObject({ status: 'failed', succeeded: 0, failed: 2, errorMessage: 'AniList 403' })
  })

  test('some children failed -> partial', async () => {
    const rows = { p: { status: 'success', succeeded: 28, failed: 0, errorMessage: null } }
    await propagateChildFailures(fakePrisma(rows), new Map([['p', { count: 1, errorMessage: 'x' }]]))
    expect(rows.p.status).toBe('partial')
  })

  test('running parent is left to finishRun', async () => {
    const rows = { p: { status: 'running', succeeded: 0, failed: 0, errorMessage: null } }
    await propagateChildFailures(fakePrisma(rows), new Map([['p', { count: 1, errorMessage: 'x' }]]))
    expect(rows.p.status).toBe('running')
  })
})
