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

import { getAppLogger } from './logger'

const logger = getAppLogger('nagisa-client')

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

/** 上流の JSON を素通しする GET プロキシの結果。失敗時は呼び出し側で 502 に畳む。 */
export type NagisaProxyResult = { ok: true; data: unknown } | { ok: false; error: string; status?: number }

/**
 * GET プロキシの共通部分。Nagisa の JSON をそのまま返すだけの経路が複数あり、
 * どれも「設定が無い」「繋がらない」「上流が 2xx 以外」で 502 に畳む挙動は同じ。
 * 差分を潰す先は本文の形だけなので、呼び出し側で型を当てる。
 *
 * *action* はログの識別子。経路ごとに `-error` / `-config-missing` / `-fetch-error` を付けて出す。
 */
export async function proxyNagisaGet(
  env: Partial<NagisaEnv>,
  path: string,
  action: string
): Promise<NagisaProxyResult> {
  try {
    const res = await fetchNagisaRaw(env, path)
    if (!res.ok) {
      const body = await res.text()
      logger.error({ action: `${action}-error`, status: res.status, body })
      return { ok: false, error: body || `Nagisa returned ${res.status}`, status: res.status }
    }
    return { ok: true, data: await res.json() }
  } catch (e) {
    if (e instanceof NagisaConfigError) {
      logger.error({ action: `${action}-config-missing`, missing: e.missing })
      return { ok: false, error: e.message }
    }
    logger.error({ action: `${action}-fetch-error`, error: e instanceof Error ? e.message : String(e) })
    return { ok: false, error: 'Failed to connect to Nagisa' }
  }
}
