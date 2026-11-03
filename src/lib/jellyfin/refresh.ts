/**
 * 録画完了後の Jellyfin ライブラリ更新 (`POST /Library/Refresh`) を送る側。
 * 設計は docs/plans/06-jellyfin-refresh.md。
 *
 * 検知 (台帳同期が dirty を立てる) と送信を D1 の状態で分離している。毎分 cron から
 * 呼ばれ、dirty でなければ D1 を 1 回読んで即 return する。
 *
 * - 送信条件: 静穏期間が過ぎた、または最大待ちを超えた。かつバックオフ中でない。
 * - 失敗は台帳同期に影響しない。throw せず、結果を返す。
 * - 401/403/404 はリトライしても直らない: 間隔を上限に固定し、Discord 通知は 1 回だけ。
 * - 5xx・接続断・タイムアウトは指数バックオフ。
 * - API キーはログ・DB・通知のどこにも出さない (本文も保存しない)。
 */

import type { createPrismaClient } from '../db'
import { COLOR_SUCCESS, COLOR_WARN, notify } from '../discord'
import { getAppLogger } from '../logger'
import { fetchJellyfinRaw, isJellyfinConfigured, type JellyfinEnv } from './client'
import { JELLYFIN_STATE_KEY } from './dirty'

const logger = getAppLogger('jellyfin')

type Prisma = ReturnType<typeof createPrismaClient>

export const DEFAULT_SETTLE_SECONDS = 120
export const DEFAULT_MAX_WAIT_SECONDS = 900
const MAX_BACKOFF_MS = 30 * 60_000
const BASE_BACKOFF_MS = 60_000
/** 送信 1 回の lease。タイムアウト (10 秒) より十分長く、次の tick には切れる長さ */
const LEASE_MS = 60_000
const MAX_ERROR_LENGTH = 500

export type RefreshEnv = Partial<JellyfinEnv> & { DISCORD_WEBHOOK_URL?: string }

export type RefreshOutcome = 'success' | 'transient-failure' | 'fatal-failure'

export interface RefreshResult {
  /** 機能が無効 (設定欠落) */
  disabled: boolean
  /** 送信を試みたか。false の tick は SyncRun を残さない */
  attempted: boolean
  outcome: RefreshOutcome | null
  /** Jellyfin の HTTP ステータス。接続断などでは null */
  status: number | null
  generation: number | null
  attempt: number | null
  error: string | null
}

const idle = (disabled = false): RefreshResult => ({
  disabled,
  attempted: false,
  outcome: null,
  status: null,
  generation: null,
  attempt: null,
  error: null
})

/** 正の整数の秒数を読む。欠落・不正は既定値。 */
export function parseSeconds(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(n) && n > 0 ? n : fallback
}

export const backoffMs = (failures: number): number => Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** failures)

/** 401/403/404 はリトライしても直らない (キー不正・非管理者・Access 拒否・URL 違い) */
export const isFatalStatus = (status: number): boolean => status === 401 || status === 403 || status === 404

interface StateRow {
  dirtyGeneration: number
  dirtySince: Date | null
  lastChangeAt: Date | null
  lastAttemptAt: Date | null
  nextAttemptAt: Date | null
  consecutiveFailures: number
  lastNotifiedAt: Date | null
}

/** いま送ってよいか (デバウンス + バックオフ)。純粋関数。 */
export function isDue(s: StateRow, now: Date, settleMs: number, maxWaitMs: number): boolean {
  if (s.dirtySince === null) return false
  if (s.nextAttemptAt !== null && s.nextAttemptAt.getTime() > now.getTime()) return false
  // 最小間隔: 前回の試行から静穏期間未満では送らない
  if (s.lastAttemptAt !== null && now.getTime() - s.lastAttemptAt.getTime() < settleMs) return false
  const quiet = s.lastChangeAt === null || now.getTime() - s.lastChangeAt.getTime() >= settleMs
  const waited = now.getTime() - s.dirtySince.getTime() >= maxWaitMs
  return quiet || waited
}

const truncate = (s: string): string => (s.length > MAX_ERROR_LENGTH ? s.slice(0, MAX_ERROR_LENGTH) : s)

/**
 * dirty かつ送信条件を満たしていれば Jellyfin に更新を依頼する。throw しない。
 * *now* はテスト用に差し替えられる。
 */
export async function runJellyfinRefresh(
  prisma: Prisma,
  env: RefreshEnv,
  now: Date = new Date()
): Promise<RefreshResult> {
  if (!isJellyfinConfigured(env)) return idle(true)

  const settleMs = parseSeconds(env.JELLYFIN_REFRESH_SETTLE_SECONDS, DEFAULT_SETTLE_SECONDS) * 1000
  const maxWaitMs = parseSeconds(env.JELLYFIN_REFRESH_MAX_WAIT_SECONDS, DEFAULT_MAX_WAIT_SECONDS) * 1000
  const owner = crypto.randomUUID()

  try {
    const before = await prisma.jellyfinRefreshState.findUnique({ where: { key: JELLYFIN_STATE_KEY } })
    if (!before || !isDue(before, now, settleMs, maxWaitMs)) return idle()

    // 同時実行は lease の count==1 で弾く (syncLibrary と同じ方式)。
    const got = await prisma.jellyfinRefreshState.updateMany({
      where: { key: JELLYFIN_STATE_KEY, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { leaseUntil: new Date(now.getTime() + LEASE_MS), leaseOwner: owner }
    })
    if (got.count === 0) return idle()

    try {
      // lease を取る前に別 run が送り終えていることがある。取ってから読み直して再判定する。
      const state = await prisma.jellyfinRefreshState.findUnique({ where: { key: JELLYFIN_STATE_KEY } })
      if (!state || !isDue(state, now, settleMs, maxWaitMs)) return idle()
      return await send(prisma, env, state, now)
    } finally {
      await prisma.jellyfinRefreshState
        .updateMany({
          where: { key: JELLYFIN_STATE_KEY, leaseOwner: owner },
          data: { leaseUntil: null, leaseOwner: null }
        })
        .catch(() => undefined)
    }
  } catch (e) {
    // D1 自体の失敗。台帳同期や他の cron を巻き込まない。
    logger.error({ action: 'jellyfin-refresh-error', error: e instanceof Error ? e.message : String(e) })
    return { ...idle(), error: truncate(e instanceof Error ? e.message : String(e)) }
  }
}

async function send(prisma: Prisma, env: RefreshEnv, state: StateRow, now: Date): Promise<RefreshResult> {
  const generation = state.dirtyGeneration
  const attempt = state.consecutiveFailures + 1
  const where = { key: JELLYFIN_STATE_KEY }

  const response = await fetchJellyfinRaw(env, '/Library/Refresh', { method: 'POST' }).then(
    (res) => ({ status: res.status, ok: res.ok, error: null as string | null }),
    (e: unknown) => ({
      status: null,
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : 'request failed'
    })
  )
  const base = { disabled: false, attempted: true, status: response.status, generation, attempt }

  if (response.ok) {
    // 送信中に dirty が立った (generation が進んだ) ときは印を消さない。次の静穏期間後に再送される。
    await prisma.jellyfinRefreshState.updateMany({
      where: { ...where, dirtyGeneration: generation },
      data: { dirtySince: null }
    })
    await prisma.jellyfinRefreshState.updateMany({
      where,
      data: {
        lastAttemptAt: now,
        lastSucceededAt: now,
        nextAttemptAt: null,
        consecutiveFailures: 0,
        lastError: null,
        lastNotifiedAt: null
      }
    })
    logger.info({ action: 'jellyfin-refresh-sent', status: response.status, generation })
    // 通知済みの障害から復旧した初回だけ知らせる
    if (state.lastNotifiedAt !== null && env.DISCORD_WEBHOOK_URL) {
      await notify(env.DISCORD_WEBHOOK_URL, {
        title: 'Jellyfin: ライブラリ更新が復旧しました',
        description: 'POST /Library/Refresh が成功しました。',
        color: COLOR_SUCCESS
      })
    }
    return { ...base, outcome: 'success', error: null }
  }

  const fatal = response.status !== null && isFatalStatus(response.status)
  const error = truncate(response.status !== null ? `HTTP ${response.status}` : (response.error ?? 'request failed'))
  const notifyNow = fatal && state.lastNotifiedAt === null
  const delay = fatal ? MAX_BACKOFF_MS : backoffMs(attempt)
  // 通知の有無を先に DB へ刻む (通知で落ちても次の tick で二重に出さない)。
  await prisma.jellyfinRefreshState.updateMany({
    where,
    data: {
      lastAttemptAt: now,
      nextAttemptAt: new Date(now.getTime() + delay),
      consecutiveFailures: attempt,
      lastError: error,
      ...(notifyNow ? { lastNotifiedAt: now } : {})
    }
  })
  logger.error({ action: 'jellyfin-refresh-failed', status: response.status, attempt, fatal, error })
  if (notifyNow && env.DISCORD_WEBHOOK_URL) {
    await notify(env.DISCORD_WEBHOOK_URL, {
      title: 'Jellyfin: ライブラリ更新に失敗しました',
      description:
        `${error}。API キー・URL・権限 (管理者) を確認してください。` +
        '修正されるまで 30 分間隔で再試行し、この通知は復旧まで再送しません。',
      color: COLOR_WARN
    })
  }
  return { ...base, outcome: fatal ? 'fatal-failure' : 'transient-failure', error }
}
