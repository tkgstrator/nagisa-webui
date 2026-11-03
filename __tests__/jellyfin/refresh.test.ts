import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { JELLYFIN_STATE_KEY } from '../../src/lib/jellyfin/dirty'
import { backoffMs, isDue, runJellyfinRefresh } from '../../src/lib/jellyfin/refresh'
import { createTestDb, startStubJellyfin } from './harness'

const notifyMock = mock(async (..._args: unknown[]) => undefined)
const discord = { ...(await import('../../src/lib/discord')) }
mock.module('../../src/lib/discord', () => ({ ...discord, notify: notifyMock }))

const T0 = new Date('2026-11-02T00:00:00.000Z')
const at = (sec: number) => new Date(T0.getTime() + sec * 1000)

const stub = await startStubJellyfin()
const ctx = await createTestDb()

const env = () => ({
  JELLYFIN_URL: stub.url,
  JELLYFIN_API_KEY: 'secret-key-value',
  DISCORD_WEBHOOK_URL: 'https://discord.invalid/hook'
})

/** dirty を立てる (台帳同期の buildDirtyWrite と同じ結果の状態) */
const markDirty = (changeAtSec: number, since = changeAtSec) =>
  ctx.prisma.jellyfinRefreshState.upsert({
    where: { key: JELLYFIN_STATE_KEY },
    create: { key: JELLYFIN_STATE_KEY, dirtyGeneration: 1, dirtySince: at(since), lastChangeAt: at(changeAtSec) },
    update: { dirtyGeneration: { increment: 1 }, dirtySince: at(since), lastChangeAt: at(changeAtSec) }
  })

const state = () => ctx.prisma.jellyfinRefreshState.findUniqueOrThrow({ where: { key: JELLYFIN_STATE_KEY } })

afterAll(async () => {
  await stub.close()
  ctx.close()
  // 他のテストファイルへ discord のモックを持ち越さない
  mock.module('../../src/lib/discord', () => discord)
})
beforeEach(() => {
  ctx.reset()
  stub.requests.length = 0
  stub.respondWith(204)
  notifyMock.mockClear()
})

describe('デバウンス', () => {
  test('設定欠落なら無効で、リクエストも飛ばない', async () => {
    await markDirty(0)
    const r = await runJellyfinRefresh(ctx.prisma, { ...env(), JELLYFIN_API_KEY: '' }, at(600))
    expect(r.disabled).toBe(true)
    expect(r.attempted).toBe(false)
    expect(stub.requests).toHaveLength(0)
  })

  test('dirty でなければ送らない', async () => {
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(600))
    expect(r.attempted).toBe(false)
    expect(stub.requests).toHaveLength(0)
  })

  test('静穏期間 (120 秒) の間は送らず、過ぎたら 1 回だけ送る', async () => {
    await markDirty(0)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(119))).attempted).toBe(false)
    expect(stub.requests).toHaveLength(0)

    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    expect(r.outcome).toBe('success')
    expect(stub.requests).toHaveLength(1)
    expect(stub.requests[0]).toMatchObject({ method: 'POST', path: '/Library/Refresh' })
    expect(stub.requests[0].authorization).toBe('MediaBrowser Token="secret-key-value"')

    const s = await state()
    expect(s.dirtySince).toBeNull()
    expect(s.lastSucceededAt).toEqual(at(120))
    // 以降の tick は何もしない (重複送信しない)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(180))).attempted).toBe(false)
    expect(stub.requests).toHaveLength(1)
  })

  test('連続完了は静穏期間がリセットされ、送信回数が完了数より少ない', async () => {
    await markDirty(0)
    await markDirty(100, 0)
    await markDirty(200, 0)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(310))).attempted).toBe(false)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(320))).outcome).toBe('success')
    expect(stub.requests).toHaveLength(1)
  })

  test('録画が止まらなくても最大待ち (900 秒) で送る', async () => {
    await markDirty(0)
    // 毎分変化し続ける
    await markDirty(890, 0)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(899))).attempted).toBe(false)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(900))).outcome).toBe('success')
    expect(stub.requests).toHaveLength(1)
  })

  test('静穏期間・最大待ちは環境変数で変えられる', async () => {
    await markDirty(0)
    const r = await runJellyfinRefresh(ctx.prisma, { ...env(), JELLYFIN_REFRESH_SETTLE_SECONDS: '10' }, at(10))
    expect(r.outcome).toBe('success')
  })

  test('送信中に dirty が立った (generation が進んだ) ときは印を消さない', async () => {
    await markDirty(0)
    // 送信のレスポンス待ちの間に別 run が dirty を立てた状況を再現する
    stub.beforeNextResponse(() => markDirty(125, 0))
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    expect(r.outcome).toBe('success')
    const s = await state()
    expect(s.dirtySince).not.toBeNull()
    expect(s.dirtyGeneration).toBe(2)
    // 次の静穏期間後に再送される
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(260))).outcome).toBe('success')
    expect(stub.requests).toHaveLength(2)
    expect((await state()).dirtySince).toBeNull()
  })

  test('lease が他に握られていれば送らない', async () => {
    await markDirty(0)
    await ctx.prisma.jellyfinRefreshState.update({
      where: { key: JELLYFIN_STATE_KEY },
      data: { leaseUntil: at(1000), leaseOwner: 'other' }
    })
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(200))).attempted).toBe(false)
    expect(stub.requests).toHaveLength(0)
  })

  test('isDue: 最小間隔 (前回試行から静穏期間未満) は送らない', () => {
    const base = {
      dirtyGeneration: 1,
      dirtySince: at(0),
      lastChangeAt: at(0),
      lastAttemptAt: at(500),
      nextAttemptAt: null,
      consecutiveFailures: 0,
      lastNotifiedAt: null
    }
    expect(isDue(base, at(600), 120_000, 900_000)).toBe(false)
    expect(isDue(base, at(620), 120_000, 900_000)).toBe(true)
  })
})

describe('失敗系', () => {
  test('500 は dirty のまま指数バックオフし、通知しない', async () => {
    await markDirty(0)
    stub.respondWith(500)
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    expect(r.outcome).toBe('transient-failure')
    const s = await state()
    expect(s.dirtySince).not.toBeNull()
    expect(s.consecutiveFailures).toBe(1)
    expect(s.nextAttemptAt).toEqual(new Date(at(120).getTime() + backoffMs(1)))
    expect(notifyMock).not.toHaveBeenCalled()

    // バックオフ中は送らない
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(121))).attempted).toBe(false)
    // バックオフ明けに再送し、2 回目はさらに伸びる
    stub.respondWith(500)
    await runJellyfinRefresh(ctx.prisma, env(), at(120 + 120))
    const s2 = await state()
    expect(s2.consecutiveFailures).toBe(2)
    expect(s2.nextAttemptAt).toEqual(new Date(at(240).getTime() + backoffMs(2)))
  })

  test('接続断も一過性として扱い、throw しない', async () => {
    await markDirty(0)
    stub.respondWith(0)
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    expect(r.outcome).toBe('transient-failure')
    expect(r.status).toBeNull()
    expect((await state()).dirtySince).not.toBeNull()
  })

  test.each([401, 403, 404])('%i は 30 分に固定し、Discord 通知は 1 回だけ', async (status) => {
    await markDirty(0)
    stub.respondWith(status)
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    expect(r.outcome).toBe('fatal-failure')
    expect((await state()).nextAttemptAt).toEqual(new Date(at(120).getTime() + 30 * 60_000))
    expect(notifyMock).toHaveBeenCalledTimes(1)

    // 30 分後の再試行でも失敗し続けるが、通知は増えない
    await runJellyfinRefresh(ctx.prisma, env(), at(120 + 1800))
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect((await state()).consecutiveFailures).toBe(2)
  })

  test('復旧した初回成功で復旧通知を 1 回出し、次の障害は再び通知できる', async () => {
    await markDirty(0)
    stub.respondWith(401)
    await runJellyfinRefresh(ctx.prisma, env(), at(120))
    stub.respondWith(204)
    expect((await runJellyfinRefresh(ctx.prisma, env(), at(120 + 1800))).outcome).toBe('success')
    expect(notifyMock).toHaveBeenCalledTimes(2)
    const s = await state()
    expect(s.consecutiveFailures).toBe(0)
    expect(s.lastNotifiedAt).toBeNull()
    expect(s.lastError).toBeNull()
  })

  test('API キーを DB・エラー・通知のどこにも出さない', async () => {
    await markDirty(0)
    stub.respondWith(401)
    const r = await runJellyfinRefresh(ctx.prisma, env(), at(120))
    const dump = JSON.stringify([await state(), r, notifyMock.mock.calls])
    expect(dump).not.toContain('secret-key-value')
  })
})
