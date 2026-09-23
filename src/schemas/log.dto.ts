import { z } from 'zod'

export const RunKindEnum = z.enum(['cron', 'queue', 'manual'])
export const RunStatusEnum = z.enum(['running', 'success', 'partial', 'failed'])

export const SyncRunSchema = z.object({
  id: z.string().nonempty(),
  kind: RunKindEnum,
  trigger: z.string().nonempty(),
  parentId: z.string().nullable(),
  status: RunStatusEnum,
  startedAt: z.coerce.string().nonempty(),
  finishedAt: z.coerce.string().nullable(),
  durationMs: z.number().int().nullable(),
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  retried: z.number().int(),
  animeCreated: z.number().int(),
  animeUpdated: z.number().int(),
  droppedLogs: z.number().int(),
  errorMessage: z.string().nullable(),
  meta: z.string().nullable()
})
export type SyncRunSchema = z.infer<typeof SyncRunSchema>

export const SyncRunListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  kind: RunKindEnum.optional(),
  status: RunStatusEnum.optional(),
  // 期間は「直近 N 時間」。既定 24h、最大 90 日 (sync_runs の保持期間)。
  hours: z.coerce.number().int().min(1).max(2160).default(24)
})
export type SyncRunListQuerySchema = z.infer<typeof SyncRunListQuerySchema>

export const PaginatedSyncRunSchema = z.object({
  data: z.array(SyncRunSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int()
})
export type PaginatedSyncRunSchema = z.infer<typeof PaginatedSyncRunSchema>

/** LogTape の重大度。D1 に入るのは info 以上だけ (src/lib/log-capture.ts) */
export const LogLevelEnum = z.enum(['debug', 'info', 'warning', 'error', 'fatal'])
export type LogLevelEnum = z.infer<typeof LogLevelEnum>

/** 指定した level 「以上」の一覧。フィルタは in 句で引く */
export const LEVELS_AT_OR_ABOVE: Record<LogLevelEnum, LogLevelEnum[]> = {
  debug: ['debug', 'info', 'warning', 'error', 'fatal'],
  info: ['info', 'warning', 'error', 'fatal'],
  warning: ['warning', 'error', 'fatal'],
  error: ['error', 'fatal'],
  fatal: ['fatal']
}

export const LogEntrySchema = z.object({
  id: z.number().int(),
  runId: z.string().nullable(),
  ts: z.coerce.string().nonempty(),
  level: LogLevelEnum,
  category: z.string().nonempty(),
  action: z.string().nullable(),
  summary: z.string().nullable(),
  props: z.string().nullable()
})
export type LogEntrySchema = z.infer<typeof LogEntrySchema>

export const LogEntryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // ページ番号だと書き込みの最中に行がずれるので、id の降順カーソルで送る (id < cursor)。
  cursor: z.coerce.number().int().min(1).optional(),
  // 指定した重大度「以上」を返す。'error' が UI の「エラーだけ」プリセット。
  level: LogLevelEnum.default('info'),
  category: z.string().optional(),
  action: z.string().optional(),
  runId: z.string().optional(),
  // 期間は「直近 N 時間」。既定 24h、最大 14 日 (log_entries の保持期間)。
  hours: z.coerce.number().int().min(1).max(336).default(24),
  /** summary の部分一致 */
  q: z.string().optional()
})
export type LogEntryListQuerySchema = z.infer<typeof LogEntryListQuerySchema>

export const CursoredLogEntrySchema = z.object({
  data: z.array(LogEntrySchema),
  /** 次ページに渡す cursor。これ以上無ければ null */
  nextCursor: z.number().int().nullable()
})
export type CursoredLogEntrySchema = z.infer<typeof CursoredLogEntrySchema>

/** 何をしたときの行か (src/lib/recording-event.ts と合わせる) */
export const RecordingEventKindEnum = z.enum(['request', 'status', 'recorded', 'not-found'])
export type RecordingEventKindEnum = z.infer<typeof RecordingEventKindEnum>

/** どこから出た行か */
export const RecordingEventSourceEnum = z.enum(['ui', 'webhook', 'cron'])
export type RecordingEventSourceEnum = z.infer<typeof RecordingEventSourceEnum>

export const RecordingEventStatusEnum = z.enum(['ok', 'error'])
export type RecordingEventStatusEnum = z.infer<typeof RecordingEventStatusEnum>

export const RecordingEventSchema = z.object({
  id: z.string().nonempty(),
  animeId: z.string().nonempty(),
  episodeId: z.string().nullable(),
  provider: z.string().nonempty(),
  contentId: z.string().nonempty(),
  title: z.string(),
  kind: RecordingEventKindEnum,
  source: RecordingEventSourceEnum,
  status: RecordingEventStatusEnum,
  httpStatus: z.number().int().nullable(),
  episodeCount: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  runId: z.string().nullable(),
  createdAt: z.coerce.string().nonempty()
})
export type RecordingEventSchema = z.infer<typeof RecordingEventSchema>

export const RecordingEventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  animeId: z.string().optional(),
  kind: RecordingEventKindEnum.optional(),
  status: RecordingEventStatusEnum.optional(),
  // 期間は「直近 N 時間」。既定 7 日、最大 180 日 (recording_events の保持期間)。
  hours: z.coerce.number().int().min(1).max(4320).default(168)
})
export type RecordingEventListQuerySchema = z.infer<typeof RecordingEventListQuerySchema>

export const PaginatedRecordingEventSchema = z.object({
  data: z.array(RecordingEventSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int()
})
export type PaginatedRecordingEventSchema = z.infer<typeof PaginatedRecordingEventSchema>

export const SyncRunDetailSchema = z.object({
  run: SyncRunSchema,
  children: z.array(SyncRunSchema),
  /** この run の中で出たログ (新しい順・上限あり) */
  entries: z.array(LogEntrySchema)
})
export type SyncRunDetailSchema = z.infer<typeof SyncRunDetailSchema>

export const CronStatSchema = z.object({
  /** wrangler.toml の crons に書かれた式 */
  cron: z.string().nonempty(),
  label: z.string().nonempty(),
  /** 一度でも実行記録があるか。false なら cron 式と scheduled.ts の case が食い違っている疑い */
  everRan: z.boolean(),
  lastRun: SyncRunSchema.nullable()
})
export type CronStatSchema = z.infer<typeof CronStatSchema>

export const LogStatsSchema = z.object({
  crons: z.array(CronStatSchema),
  /** 直近 24h の件数 */
  recent: z.object({
    total: z.number().int(),
    success: z.number().int(),
    partial: z.number().int(),
    failed: z.number().int(),
    running: z.number().int()
  })
})
export type LogStatsSchema = z.infer<typeof LogStatsSchema>
