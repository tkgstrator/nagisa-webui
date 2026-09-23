import { AsyncLocalStorage } from 'node:async_hooks'
import type { LogRecord } from '@logtape/logtape'
import type { createPrismaClient } from './db'

type Prisma = ReturnType<typeof createPrismaClient>

/** D1 に落とすログの下限。debug は量が多すぎるので既定では捨てる。 */
const PERSIST_LEVELS = new Set(['info', 'warning', 'error', 'fatal'])

/** 1 run で溜め込むログ行の上限。超えた分は捨てて droppedLogs に計上する。 */
const MAX_ENTRIES = 2000

/** D1 の bind 変数上限 (999) に引っかからないよう createMany を分割する行数。 */
const INSERT_CHUNK = 80

/** props の JSON 文字列の上限。巨大なレスポンス丸ごとを保存しないための蓋。 */
const MAX_PROPS_BYTES = 4096

/** summary の上限。一覧の 1 行に収める前提なので短くて良い。 */
const MAX_SUMMARY_LENGTH = 500

export interface CaptureEntry {
  runId: string | null
  ts: Date
  level: string
  category: string
  action: string | null
  summary: string | null
  props: string | null
}

export interface CaptureStore {
  runId: string | null
  entries: CaptureEntry[]
  /** MAX_ENTRIES を超えて捨てた行数 */
  dropped: number
}

/**
 * ログの宛先 (どの run のものか) を実行コンテキストごとに持ち回す。
 * これがあるおかげで `src/lib/sync.ts` などの呼び出し側は runId を意識せずに済む。
 * Lambda 側では `runWithCapture` を呼ばないので常に undefined = sink は no-op。
 */
const als = new AsyncLocalStorage<CaptureStore>()

export function createStore(runId: string | null): CaptureStore {
  return { runId, entries: [], dropped: 0 }
}

/** `fn` の実行中に出たログを `store` に溜める。非同期の子も同じ store を見る。 */
export function runWithCapture<T>(store: CaptureStore, fn: () => Promise<T>): Promise<T> {
  return als.run(store, fn)
}

export function currentStore(): CaptureStore | undefined {
  return als.getStore()
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** props は JSON 文字列で持つ。循環参照などで落ちても呼び出し元を巻き込まない。 */
function serializeProps(props: Record<string, unknown>): string | null {
  const keys = Object.keys(props)
  if (keys.length === 0) return null
  try {
    const json = JSON.stringify(props)
    return json.length > MAX_PROPS_BYTES ? json.slice(0, MAX_PROPS_BYTES) : json
  } catch {
    return null
  }
}

/**
 * 一覧に出す 1 行。message があればそれ、無ければ props を `k=v` で並べる。
 * action は専用カラムに出すので summary からは省く。
 */
function buildSummary(message: string, props: Record<string, unknown>): string | null {
  if (message !== '') return truncate(message, MAX_SUMMARY_LENGTH)
  const parts: string[] = []
  for (const [k, v] of Object.entries(props)) {
    if (k === 'action') continue
    parts.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
  }
  return parts.length === 0 ? null : truncate(parts.join(' '), MAX_SUMMARY_LENGTH)
}

/**
 * LogTape の sink から呼ばれる。store が無ければ (= run の外、あるいは Lambda) 何もしない。
 * **ここから app logger を呼んではいけない** (sink の再入で無限ループになる)。
 */
export function pushEntry(record: LogRecord): void {
  const store = als.getStore()
  if (store === undefined) return
  if (!PERSIST_LEVELS.has(record.level)) return
  if (store.entries.length >= MAX_ENTRIES) {
    store.dropped++
    return
  }
  const { action, ...rest } = record.properties as Record<string, unknown>
  const message = record.message.filter((m) => typeof m === 'string').join('')
  store.entries.push({
    runId: store.runId,
    ts: new Date(record.timestamp),
    level: record.level,
    // カテゴリは ['app', 'queue'] の形。頭の 'app' は全行共通なので落とす。
    category: record.category.slice(1).join('.') || record.category.join('.'),
    action: typeof action === 'string' ? action : null,
    summary: buildSummary(message, rest),
    props: serializeProps(rest)
  })
}

/**
 * 溜めたログを D1 に書き出す。**`finishRun` より前・`prisma.$disconnect()` より前**に呼ぶこと
 * (`src/lib/db.ts` がクライアントを使い回すので disconnect 後の書き込みは失敗する)。
 * 捨てた行数を返すので、呼び出し元は `finishRun` の droppedLogs に渡す。
 * ログの都合で本処理を落とさないよう、失敗しても throw しない。
 */
export async function flushLogs(prisma: Prisma, store: CaptureStore): Promise<number> {
  const entries = store.entries.splice(0)
  if (entries.length === 0) return store.dropped
  for (let i = 0; i < entries.length; i += INSERT_CHUNK) {
    try {
      await prisma.logEntry.createMany({ data: entries.slice(i, i + INSERT_CHUNK) })
    } catch {
      // ここで logger を呼ぶと sink → store → flush の再入になるので握り潰す。
      // 失われたログは sync_runs.dropped_logs には出ないが、console sink には出ている。
    }
  }
  return store.dropped
}
