/**
 * 録画リクエストとその結末を `recording_events` に 1 行ずつ残す。
 *
 * 生ログ (`log_entries`) との住み分け:
 *   - 保持期間が違う (録画 180 日 / 生ログ 14 日)
 *   - `animeId` で引きたい (作品ページから「この作品の録画履歴」を出す)
 *   - 送信 (画面/キュー) と結果 (台帳同期) を 1 本の時系列にまとめたい
 *
 * **書き込みに失敗しても絶対に throw しない**。ここは録画本体の副作用であって、
 * 履歴が残せなかったことで録画リクエストそのものを落としてはいけない。
 */

import type { createPrismaClient } from './db'
import { currentStore } from './log-capture'
import { getAppLogger } from './logger'

const logger = getAppLogger('recording-event')

type Prisma = ReturnType<typeof createPrismaClient>

/** 何をしたときの行か。UI の絞り込みもこの 4 値で出す。 */
export type RecordingEventKind = 'request' | 'status' | 'recorded' | 'not-found'

/** どこから出た行か。 */
export type RecordingEventSource = 'ui' | 'webhook' | 'cron'

/** エラーメッセージの上限。上流のレスポンス本文がそのまま来ることがある。 */
const MAX_ERROR_LENGTH = 1000

/** 1 度に積める行数の上限。まとめ投入で D1 のクエリ数を食い潰さないための蓋。 */
const MAX_EVENTS_PER_CALL = 100

export interface RecordingEventInput {
  animeId: string
  episodeId?: string | null
  provider: string
  contentId: string
  title: string
  kind: RecordingEventKind
  source: RecordingEventSource
  status: 'ok' | 'error'
  httpStatus?: number | null
  episodeCount?: number | null
  errorMessage?: string | null
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function toRow(input: RecordingEventInput, runId: string | null) {
  return {
    animeId: input.animeId,
    episodeId: input.episodeId ?? null,
    provider: input.provider,
    contentId: input.contentId,
    title: input.title,
    kind: input.kind,
    source: input.source,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    episodeCount: input.episodeCount ?? null,
    errorMessage: input.errorMessage == null ? null : truncate(input.errorMessage, MAX_ERROR_LENGTH),
    runId
  }
}

/** 1 件記録する。失敗は warn に落として握り潰す。 */
export async function recordEvent(prisma: Prisma, input: RecordingEventInput): Promise<void> {
  await recordEvents(prisma, [input])
}

/** まとめて記録する。1 件でも書けなければ warn に落として握り潰す。 */
export async function recordEvents(prisma: Prisma, inputs: RecordingEventInput[]): Promise<void> {
  if (inputs.length === 0) return
  const runId = currentStore()?.runId ?? null
  const rows = inputs.slice(0, MAX_EVENTS_PER_CALL).map((i) => toRow(i, runId))
  try {
    await prisma.recordingEvent.createMany({ data: rows })
  } catch (e) {
    // ここで throw すると録画リクエスト自体が 500 になる。履歴は落としても良い。
    logger.warn({
      action: 'recording-event-write-failed',
      count: rows.length,
      error: e instanceof Error ? e.message : String(e)
    })
  }
}
