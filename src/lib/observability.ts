/**
 * 生ログタブのデータ源。Workers Logs (Workers Observability) の Telemetry API を叩く。
 *
 * ログ本体は LogTape の console sink が JSON 1 行で出しているだけで (src/lib/logger.ts)、
 * Workers Logs がそれを構造化して 7 日間持っている。ここではその中から自分の Worker の
 * LogTape の行 (`logger` が `app.` で始まるもの) だけを引いて、一覧用の形に畳む。
 *
 * フィルタに使うキー名は Workers Logs が JSON を展開したときの名前。
 * 変わったら `scripts/observability/check-keys.ts` で実物を見て KEYS を直すこと。
 */

import { z } from 'zod'
import { LEVELS_AT_OR_ABOVE, type LogEntrySchema, type LogLevelEnum } from '../schemas/log.dto'

const API_BASE = 'https://api.cloudflare.com/client/v4'

/** Workers Logs 上のキー名。source 側 (ログ本文の JSON) は接頭辞なしで引く */
export const KEYS = {
  service: '$metadata.service',
  level: 'level',
  logger: 'logger',
  action: 'properties.action',
  runId: 'properties.runId'
} as const

/** LogTape の JSON Lines formatter が書く level (warning だけ WARN に縮む) */
const JSON_LEVEL: Record<LogLevelEnum, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
  fatal: 'FATAL'
}

/** props の JSON 文字列の上限。巨大なレスポンス丸ごとを返さないための蓋。 */
const MAX_PROPS_BYTES = 4096

/** summary の上限。一覧の 1 行に収める前提なので短くて良い。 */
const MAX_SUMMARY_LENGTH = 500

export interface ObservabilityEnv {
  CF_ACCOUNT_ID?: string
  CF_OBSERVABILITY_TOKEN?: string
  /** $metadata.service で絞る Worker 名。staging と production が同じアカウントに居るため必須 */
  WORKER_NAME?: string
}

export class ObservabilityNotConfiguredError extends Error {
  constructor() {
    super('CF_ACCOUNT_ID / CF_OBSERVABILITY_TOKEN / WORKER_NAME が設定されていない')
  }
}

export class ObservabilityUpstreamError extends Error {}

export interface LogQuery {
  limit: number
  /** 前ページ最後の行の id ($metadata.id) */
  cursor?: string
  level: LogLevelEnum
  category?: string
  action?: string
  runId?: string
  hours: number
  q?: string
}

const EventSchema = z.object({
  $metadata: z
    .object({
      id: z.string(),
      level: z.string().optional(),
      message: z.string().optional(),
      requestId: z.string().optional(),
      trigger: z.string().optional()
    })
    .passthrough(),
  source: z.unknown(),
  timestamp: z.number()
})
type Event = z.infer<typeof EventSchema>

const ResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(z.object({ message: z.string() }).passthrough()).optional(),
  result: z
    .object({
      events: z
        .object({ events: z.array(EventSchema).optional() })
        .passthrough()
        .optional()
    })
    .passthrough()
    .optional()
})

/** LogTape が書いた 1 行。source は文字列のまま来ることもあるので両方受ける */
const SourceSchema = z
  .object({
    level: z.string().optional(),
    message: z.string().optional(),
    logger: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

function parseSource(raw: unknown): z.infer<typeof SourceSchema> {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return { message: raw }
    }
  }
  const parsed = SourceSchema.safeParse(value)
  return parsed.success ? parsed.data : {}
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function toLevel(jsonLevel: string | undefined, metaLevel: string | undefined): LogLevelEnum {
  const found = (Object.entries(JSON_LEVEL) as [LogLevelEnum, string][]).find(([, v]) => v === jsonLevel)
  if (found !== undefined) return found[0]
  // LogTape 以外の行の保険。console.warn → warn, console.error → error
  if (metaLevel === 'warn') return 'warning'
  if (metaLevel === 'error') return 'error'
  if (metaLevel === 'debug') return 'debug'
  return 'info'
}

function serializeProps(props: Record<string, unknown>): string | null {
  if (Object.keys(props).length === 0) return null
  try {
    const json = JSON.stringify(props)
    return json.length > MAX_PROPS_BYTES ? json.slice(0, MAX_PROPS_BYTES) : json
  } catch {
    return null
  }
}

/** message があればそれ、無ければ props を `k=v` で並べる (action は専用の列に出す) */
function buildSummary(message: string | undefined, props: Record<string, unknown>): string | null {
  if (message !== undefined && message !== '') return truncate(message, MAX_SUMMARY_LENGTH)
  const parts = Object.entries(props).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  return parts.length === 0 ? null : truncate(parts.join(' '), MAX_SUMMARY_LENGTH)
}

export function toLogEntry(e: Event): LogEntrySchema {
  const src = parseSource(e.source)
  const { action, runId, ...rest } = src.properties ?? {}
  return {
    id: e.$metadata.id,
    runId: typeof runId === 'string' ? runId : null,
    requestId: e.$metadata.requestId ?? null,
    ts: new Date(e.timestamp).toISOString(),
    level: toLevel(src.level, e.$metadata.level),
    // logger は 'app.queue' の形。頭の 'app.' は全行共通なので落とす
    category: src.logger?.replace(/^app\./, '') ?? 'worker',
    action: typeof action === 'string' ? action : null,
    summary: buildSummary(src.message ?? e.$metadata.message, rest),
    props: serializeProps(rest)
  }
}

type Filter = { key: string; operation: string; type: 'string'; value?: string }

function buildFilters(env: Required<ObservabilityEnv>, q: LogQuery): Filter[] {
  const filters: Filter[] = [
    { key: KEYS.service, operation: 'eq', type: 'string', value: env.WORKER_NAME },
    // LogTape の行だけ。ランタイムの invocation ログ (リクエスト 1 本ごとの行) は混ぜない
    { key: KEYS.logger, operation: 'starts_with', type: 'string', value: 'app.' },
    {
      key: KEYS.level,
      operation: 'in',
      type: 'string',
      value: LEVELS_AT_OR_ABOVE[q.level].map((l) => JSON_LEVEL[l]).join(',')
    }
  ]
  if (q.category) filters.push({ key: KEYS.logger, operation: 'eq', type: 'string', value: `app.${q.category}` })
  if (q.action) filters.push({ key: KEYS.action, operation: 'eq', type: 'string', value: q.action })
  if (q.runId) filters.push({ key: KEYS.runId, operation: 'eq', type: 'string', value: q.runId })
  return filters
}

function requireEnv(env: ObservabilityEnv): Required<ObservabilityEnv> {
  const { CF_ACCOUNT_ID, CF_OBSERVABILITY_TOKEN, WORKER_NAME } = env
  if (!CF_ACCOUNT_ID || !CF_OBSERVABILITY_TOKEN || !WORKER_NAME) throw new ObservabilityNotConfiguredError()
  return { CF_ACCOUNT_ID, CF_OBSERVABILITY_TOKEN, WORKER_NAME }
}

/**
 * 新しい順に limit 件返す。次ページがあるかは 1 件多く取って判断する。
 * 設定が無ければ ObservabilityNotConfiguredError、API が失敗したら ObservabilityUpstreamError。
 */
export async function queryLogEntries(
  env: ObservabilityEnv,
  q: LogQuery,
  now: number = Date.now()
): Promise<{ data: LogEntrySchema[]; nextCursor: string | null }> {
  const cfg = requireEnv(env)
  const body = {
    queryId: 'admin-logs-entries',
    view: 'events',
    timeframe: { from: now - q.hours * 60 * 60 * 1000, to: now },
    limit: q.limit + 1,
    ...(q.cursor ? { offset: q.cursor, offsetDirection: 'next' } : {}),
    parameters: {
      filters: buildFilters(cfg, q),
      filterCombination: 'and',
      ...(q.q ? { needle: { value: q.q, matchCase: false } } : {})
    }
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/accounts/${cfg.CF_ACCOUNT_ID}/workers/observability/telemetry/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.CF_OBSERVABILITY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (e) {
    throw new ObservabilityUpstreamError(e instanceof Error ? e.message : String(e))
  }
  const json: unknown = await res.json().catch(() => null)
  const parsed = ResponseSchema.safeParse(json)
  if (!res.ok || !parsed.success || !parsed.data.success) {
    const message = parsed.success ? parsed.data.errors?.map((e) => e.message).join('; ') : undefined
    throw new ObservabilityUpstreamError(`telemetry query failed: ${res.status} ${message ?? ''}`.trim())
  }

  const events = parsed.data.result?.events?.events ?? []
  const rows = events.map(toLogEntry)
  const hasNext = rows.length > q.limit
  const data = hasNext ? rows.slice(0, q.limit) : rows
  return { data, nextCursor: hasNext ? (data.at(-1)?.id ?? null) : null }
}
