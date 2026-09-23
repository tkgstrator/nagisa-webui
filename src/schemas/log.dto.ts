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

export const SyncRunDetailSchema = z.object({
  run: SyncRunSchema,
  children: z.array(SyncRunSchema)
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
