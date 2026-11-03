/**
 * Jellyfin への HTTP 呼び出しを 1 箇所に集めたもの (`nagisa-client.ts` と同じ作り)。
 *
 * `fetchJellyfinRaw` はステータスを解釈せずに Response をそのまま返す。
 * 401/403/404 (リトライしても直らない) と 5xx (一時障害) を分けるのは
 * 呼び出し側 (`refresh.ts`) の仕事で、ここで `res.ok` に潰すと区別が付かなくなる。
 *
 * API キーはログ・DB・エラーメッセージのどこにも出さない。値を組み立てるのはこのファイルだけ。
 */

/** 1 リクエストの待ち時間。cron の 1 tick を Jellyfin の遅延で食い潰さないための上限。 */
export const JELLYFIN_TIMEOUT_MS = 10_000

const JELLYFIN_CONFIG_KEYS = ['JELLYFIN_URL', 'JELLYFIN_API_KEY'] as const

export interface JellyfinEnv {
  /** var。末尾スラッシュは剥がす */
  JELLYFIN_URL: string
  /** secret。管理者権限の API キー */
  JELLYFIN_API_KEY: string
  /** 任意 (var)。Jellyfin が Cloudflare Access の裏にあるときのサービストークン */
  JELLYFIN_ACCESS_CLIENT_ID?: string
  /** 任意 (secret) */
  JELLYFIN_ACCESS_CLIENT_SECRET?: string
  /** 任意 (var)。静穏期間 (秒)。既定 120 */
  JELLYFIN_REFRESH_SETTLE_SECONDS?: string
  /** 任意 (var)。最大待ち (秒)。既定 900 */
  JELLYFIN_REFRESH_MAX_WAIT_SECONDS?: string
}

/** 必須の環境変数が欠けていればキー名を返す。空なら機能は有効。 */
export function missingJellyfinConfig(env: Partial<JellyfinEnv>): string[] {
  return JELLYFIN_CONFIG_KEYS.filter((key) => !env[key])
}

/** 機能が有効か (URL と API キーが両方ある)。無効のときは dirty も立てない。 */
export const isJellyfinConfigured = (env: Partial<JellyfinEnv>): boolean => missingJellyfinConfig(env).length === 0

/** 環境変数が足りず、リクエストを組み立てられなかったことを表す。 */
export class JellyfinConfigError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Jellyfin config missing: ${missing.join(', ')}`)
    this.name = 'JellyfinConfigError'
    this.missing = missing
  }
}

/**
 * Jellyfin の API を叩き、Response をそのまま返す。*path* は `/Library/Refresh` のような絶対パス。
 *
 * @throws {JellyfinConfigError} 環境変数が欠けているとき
 */
export async function fetchJellyfinRaw(env: Partial<JellyfinEnv>, path: string, init?: RequestInit): Promise<Response> {
  const missing = missingJellyfinConfig(env)
  if (missing.length > 0) throw new JellyfinConfigError(missing)
  const base = (env.JELLYFIN_URL as string).replace(/\/+$/, '')
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `MediaBrowser Token="${env.JELLYFIN_API_KEY}"`)
  if (env.JELLYFIN_ACCESS_CLIENT_ID && env.JELLYFIN_ACCESS_CLIENT_SECRET) {
    headers.set('CF-Access-Client-Id', env.JELLYFIN_ACCESS_CLIENT_ID)
    headers.set('CF-Access-Client-Secret', env.JELLYFIN_ACCESS_CLIENT_SECRET)
  }
  return await fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(JELLYFIN_TIMEOUT_MS),
    ...init,
    headers
  })
}
