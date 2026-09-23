/**
 * Nagisa (録画バックエンド) への HTTP 呼び出しを 1 箇所に集めたもの。
 *
 * Nagisa は Cloudflare Access の後ろに居るので、サービストークンの 2 ヘッダを
 * 必ず添える必要がある。ルートハンドラ・cron・Queue consumer のどこから呼んでも
 * 同じ付け方になるよう、素の `fetch` をここ以外で書かないことにしている。
 *
 * `fetchNagisaRaw` は **ステータスを解釈せずに Response をそのまま返す**。
 * 台帳の差分取得はカーソル失効を 410 / 409 で受け取って bootstrap に落ちる契約
 * (→ docs/features/recording-sync.md §7-1) なので、`res.ok` で潰してしまうと
 * 「繋がらなかった」と「カーソルが古い」を区別できなくなる。
 */

const NAGISA_CONFIG_KEYS = ['BACKEND_URL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'] as const

export interface NagisaEnv {
  BACKEND_URL: string
  CF_ACCESS_CLIENT_ID: string
  CF_ACCESS_CLIENT_SECRET: string
}

/** Nagisa への接続に必要な環境変数が揃っているか検査する。欠けていればキー名を返す */
export function missingNagisaConfig(env: Partial<NagisaEnv>): string[] {
  return NAGISA_CONFIG_KEYS.filter((key) => !env[key])
}

/** 環境変数が足りず、そもそもリクエストを組み立てられなかったことを表す。 */
export class NagisaConfigError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Nagisa config missing: ${missing.join(', ')}`)
    this.name = 'NagisaConfigError'
    this.missing = missing
  }
}

/**
 * Nagisa の API を叩き、Response をそのまま返す。
 *
 * *path* は `/api/...` から始まる絶対パス。`BACKEND_URL` の末尾スラッシュは
 * 剥がすので、環境変数がどちらの書き方でも同じ URL になる。
 *
 * @throws {NagisaConfigError} 環境変数が欠けているとき
 */
export async function fetchNagisaRaw(env: Partial<NagisaEnv>, path: string, init?: RequestInit): Promise<Response> {
  const missing = missingNagisaConfig(env)
  if (missing.length > 0) throw new NagisaConfigError(missing)
  const base = (env.BACKEND_URL as string).replace(/\/+$/, '')
  return await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID as string,
      'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET as string
    }
  })
}
