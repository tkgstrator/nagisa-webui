import { describe, expect, test, vi } from 'vitest'
import { LogStatsSchema } from '../../src/schemas/log.dto'

vi.mock('../../src/lib/db', () => ({
  createPrismaClient: () => ({
    syncRun: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      groupBy: async () => []
    },
    $disconnect: async () => undefined
  })
}))

const { default: adminLogs } = await import('../../src/routes/admin-logs')

const env = { DB: {} }

// `/sync-runs/{id}` が先に登録されると "stats" が id として吸われ 404 になる回帰を防ぐ
describe('admin-logs route order', () => {
  test('GET /sync-runs/stats は統計を返す', async () => {
    const res = await adminLogs.request('/sync-runs/stats', {}, env)
    expect(res.status).toBe(200)
    expect(LogStatsSchema.safeParse(await res.json()).success).toBe(true)
  })

  test('GET /sync-runs/{存在しない id} は 404', async () => {
    const res = await adminLogs.request('/sync-runs/nonexistent', {}, env)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: 'run not found' })
  })
})
