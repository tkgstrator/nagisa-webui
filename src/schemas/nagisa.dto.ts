import { z } from 'zod'

const ProviderEnum = z.enum(['amazon', 'crunchyroll', 'hulu', 'abema'])
const LanguageEnum = z.enum(['sub', 'dub'])
const MarketplaceEnum = z.enum(['jp', 'us'])
const ContentTypeEnum = z.enum(['movie', 'series'])

// --- Queue response (POST /api/queues) ---

const NagisaSeasonFilterSchema = z.object({
  season_number: z.number().int(),
  episodes: z.array(z.number().int()).nullable()
})

export const NagisaEpisodePreviewSchema = z.object({
  number: z.number().int(),
  title: z.string().nonempty(),
  title_en: z.string().nonempty().optional(),
  content_id: z.string().nonempty(),
  duration: z.number().nonnegative().nullable()
})

export const NagisaPreviewSchema = z.object({
  content_type: ContentTypeEnum,
  title: z.string().nonempty(),
  title_en: z.string().nonempty().optional(),
  marketplace: MarketplaceEnum,
  total_episodes: z.number().int(),
  selected_episodes: z.number().int(),
  media_capabilities: z.array(z.string().nonempty()).nullable(),
  episodes: z.array(NagisaEpisodePreviewSchema)
})

export const NagisaQueueResponseJobSchema = z.object({
  job_id: z.string().nonempty(),
  status: z.string().nonempty(),
  name: z.string().nonempty(),
  data: z.object({
    provider: ProviderEnum,
    content_id: z.string().nonempty(),
    title: z.string().nonempty(),
    seasons: z.array(NagisaSeasonFilterSchema).nullable(),
    marketplace: MarketplaceEnum.optional(),
    language: LanguageEnum.optional(),
    force: z.boolean().optional()
  }),
  timestamp: z.number(),
  preview: NagisaPreviewSchema.optional()
})

export const NagisaQueueResponseSchema = z.object({
  count: z.number().int(),
  jobs: z.array(NagisaQueueResponseJobSchema)
})
export type NagisaQueueResponseSchema = z.infer<typeof NagisaQueueResponseSchema>

// --- Direct job enqueue (POST /api/queues, items+seasons form) ---

const NagisaEnqueueSeasonSchema = z.object({
  season_number: z.number().int().positive(),
  episodes: z.array(z.number().int().positive()).optional()
})

const NagisaEnqueueItemSchema = z.object({
  content_id: z.string().nonempty(),
  seasons: z.array(NagisaEnqueueSeasonSchema).optional(),
  /** true にすると Nagisa 側で既存の出力ファイルをスキップせず再ダウンロードする (Nagisa 1.4.x〜) */
  force: z.boolean().optional(),
  /**
   * この content_id がどの AniList 作品か (Nagisa 1.7.x〜)。Nagisa は受け取った対応を
   * 台帳に控え、`GET /api/library/anilist/{id}` で引けるようにする。0 以下は 400 になるので送らない。
   * それより前の Nagisa は未知のキーとして無視する。
   */
  anilist_id: z.number().int().positive().optional()
})

export const NagisaEnqueueRequestSchema = z.object({
  provider: ProviderEnum,
  items: z.array(NagisaEnqueueItemSchema).nonempty(),
  marketplace: MarketplaceEnum.optional(),
  language: LanguageEnum.optional(),
  /** items で個別指定が無い場合のデフォルト force。true で既存ファイルを再ダウンロード (Nagisa 1.4.x〜) */
  force: z.boolean().optional()
})
export type NagisaEnqueueRequest = z.infer<typeof NagisaEnqueueRequestSchema>

/** /api/queues のレスポンスは既存の NagisaQueueResponseSchema と同形 */
export const NagisaEnqueueResponseSchema = NagisaQueueResponseSchema
export type NagisaEnqueueResponse = z.infer<typeof NagisaEnqueueResponseSchema>

// --- Status response (GET /api/status) ---

const NagisaJobProgressSchema = z.object({
  current: z.number().int(),
  total: z.number().int()
})

// episodes が null のジョブはシーズン全体が対象 (話を絞らずに積んだもの)。
const NagisaStatusJobSeasonSchema = z.object({
  season_number: z.number().int(),
  episodes: z.array(z.number().int()).nullable()
})

export const NagisaStatusJobSchema = z.object({
  job_id: z.string().nonempty(),
  provider: ProviderEnum,
  content_id: z.string().nonempty(),
  title: z.string().nullable(),
  seasons: z.array(NagisaStatusJobSeasonSchema).nullable(),
  marketplace: MarketplaceEnum.nullable(),
  progress: NagisaJobProgressSchema.nullable(),
  timestamp: z.number(),
  /**
   * ワーカーが拾った時刻。**待機中 (wait) と遅延中 (delayed) のジョブは null**
   * — /api/status は全 state を返すので、必須にすると 1 件でも待ち行列に
   * 積まれた瞬間にステータス全体の parse が落ちる (実応答で確認済み)。
   */
  processedOn: z.number().nullable(),
  finishedOn: z.number().nullable(),
  failedReason: z.string().nullable()
})
export type NagisaStatusJob = z.infer<typeof NagisaStatusJobSchema>

const NagisaQueueCategorySchema = z.object({
  count: z.number().int(),
  jobs: z.array(NagisaStatusJobSchema)
})

const NagisaQueueSchema = z.object({
  wait: NagisaQueueCategorySchema,
  active: NagisaQueueCategorySchema,
  completed: NagisaQueueCategorySchema,
  failed: NagisaQueueCategorySchema,
  delayed: NagisaQueueCategorySchema
})

export const NagisaRedisSchema = z.object({
  connected: z.boolean(),
  memory_used: z.string().nonempty(),
  uptime: z.number().int()
})

export const NagisaSystemSchema = z.object({
  cpu_percent: z.number(),
  memory_percent: z.number(),
  disk_free_gb: z.number()
})

export const NagisaStatusSchema = z.object({
  version: z.string().nonempty(),
  uptime: z.number().int(),
  queue: NagisaQueueSchema.nullable(),
  redis: NagisaRedisSchema.nullable(),
  system: NagisaSystemSchema.nullable()
})
export type NagisaStatusSchema = z.infer<typeof NagisaStatusSchema>

// --- Queue snapshot (GET /api/queue/snapshot) ---
//
// Nagisa 側 (`nagisa/server/status.py`) は snake_case でそのまま返す。
// /api/status の camelCase とは別形なので、変換せずに契約どおり受ける。

export const NagisaJobStateEnum = z.enum(['active', 'wait', 'completed', 'failed', 'delayed'])
export type NagisaJobState = z.infer<typeof NagisaJobStateEnum>

export const NagisaQueueSnapshotJobSchema = z.object({
  job_id: z.string().nonempty(),
  state: NagisaJobStateEnum,
  provider: ProviderEnum,
  content_id: z.string().nonempty(),
  title: z.string().nullable(),
  seasons: z.array(NagisaStatusJobSeasonSchema).nullable(),
  progress: NagisaJobProgressSchema.nullable(),
  attempts: z.number().int(),
  failed_reason: z.string().nullable(),
  timestamp: z.number(),
  processed_on: z.number().nullable(),
  finished_on: z.number().nullable()
})
export type NagisaQueueSnapshotJob = z.infer<typeof NagisaQueueSnapshotJobSchema>

export const NagisaQueueSnapshotSchema = z.object({
  jobs: z.array(NagisaQueueSnapshotJobSchema),
  /**
   * state ごとの件数。jobs は terminal state を窓で切って返すので
   * counts と jobs の件数は一致しない (advisory であって突合には使えない)
   */
  counts: z.record(NagisaJobStateEnum, z.number().int()),
  generated_at: z.number().int()
})
export type NagisaQueueSnapshot = z.infer<typeof NagisaQueueSnapshotSchema>

// --- Recording ledger (GET /api/library/*) ---
//
// cursor は Nagisa が発行する不透明トークン。**Workers 側で中身を解釈しない**
// (失効判定は 410 / 409 を返す Nagisa 側の責務で、両側が持つと必ずずれる)。

export const NagisaLibraryItemSchema = z.object({
  provider: z.string().nonempty(),
  content_id: z.string().nullable(),
  episode_id: z.string().nullable(),
  season_number: z.number().int().nullable(),
  episode_number: z.number().int().nullable(),
  /** ライブラリルートからの相対パス */
  path: z.string().nonempty(),
  size: z.number().int(),
  mtime: z.string().nullable()
})
export type NagisaLibraryItem = z.infer<typeof NagisaLibraryItemSchema>

export const NagisaLibraryChangeSchema = z.object({
  seq: z.number().int(),
  op: z.enum(['upsert', 'delete']),
  recording_id: z.string().nonempty(),
  changed_at: z.string().nonempty(),
  /** op === 'upsert' のときだけ付く。delete は tombstone なので本文を持たない */
  item: NagisaLibraryItemSchema.optional()
})
export type NagisaLibraryChange = z.infer<typeof NagisaLibraryChangeSchema>

export const NagisaLibraryChangesSchema = z.object({
  epoch: z.string().nonempty(),
  changes: z.array(NagisaLibraryChangeSchema),
  next_cursor: z.string().nonempty(),
  has_more: z.boolean()
})
export type NagisaLibraryChanges = z.infer<typeof NagisaLibraryChangesSchema>

export const NagisaLibrarySnapshotSchema = z.object({
  epoch: z.string().nonempty(),
  /** 初回ページで固定される台帳の head。以降のページもこの位置を指し続ける */
  snapshot_seq: z.number().int(),
  items: z.array(NagisaLibraryItemSchema.extend({ recording_id: z.string().nonempty() })),
  /** このスナップショットの続き。最終ページでは null */
  next_cursor: z.string().nonempty().nullable(),
  /**
   * 最終ページを適用し終えた後に /changes を再開する位置。
   * head ではなく snapshot_seq に固定されているので、スナップショットを
   * 捲っている間に書かれたイベントは読み直しになる (適用は冪等)。
   */
  changes_cursor: z.string().nonempty(),
  has_more: z.boolean()
})
export type NagisaLibrarySnapshot = z.infer<typeof NagisaLibrarySnapshotSchema>

export const NagisaLibraryStatsSchema = z.object({
  epoch: z.string().nonempty(),
  last_seq: z.number().int(),
  /** 台帳 head をそのまま changes カーソルにしたもの */
  cursor: z.string().nonempty(),
  recordings: z.number().int(),
  /** provider / episode_id を解決できていない行数 */
  unresolved: z.number().int(),
  total_size: z.number().int()
})
export type NagisaLibraryStats = z.infer<typeof NagisaLibraryStatsSchema>

/** Nagisa 側のエラー契約 (410 epoch_changed / cursor_expired, 409 cursor_ahead / not_initialized, 503 ...) */
export const NagisaLibraryErrorSchema = z.object({
  error: z.string().nonempty(),
  message: z.string().nonempty()
})
export type NagisaLibraryError = z.infer<typeof NagisaLibraryErrorSchema>

// --- AniList 作品ごとの録画状況 (Nagisa 1.7.x〜) ---
//
// Nagisa は (provider, content_id) → anilist_id の対応を台帳に持つ。対応は投入時の
// `anilist_id` か `PUT /api/library/titles` でしか入らず、Nagisa 側で推測はしない。

export const NagisaTitleMappingSchema = z.object({
  provider: ProviderEnum,
  content_id: z.string().nonempty(),
  anilist_id: z.number().int().positive()
})
export type NagisaTitleMapping = z.infer<typeof NagisaTitleMappingSchema>

export const NagisaTitlesRequestSchema = z.object({
  titles: z.array(NagisaTitleMappingSchema)
})
export type NagisaTitlesRequest = z.infer<typeof NagisaTitlesRequestSchema>

export const NagisaAnilistRecordingSchema = z.object({
  recording_id: z.string().nonempty(),
  episode_id: z.string().nullable(),
  season_number: z.number().int().nullable(),
  episode_number: z.number().int().nullable(),
  /** ライブラリルートからの相対パス */
  path: z.string().nonempty(),
  size: z.number().int(),
  mtime: z.string().nullable()
})
export type NagisaAnilistRecording = z.infer<typeof NagisaAnilistRecordingSchema>

export const NagisaAnilistTitleSchema = z.object({
  provider: z.string().nonempty(),
  content_id: z.string().nonempty(),
  updated_at: z.string().nonempty(),
  /** 台帳の行。対応はあるが何も録れていない作品は空配列 */
  recordings: z.array(NagisaAnilistRecordingSchema),
  /** 待機中・実行中のジョブ。キューが読めなかったときは null (空配列とは別物) */
  jobs: z.array(NagisaQueueSnapshotJobSchema).nullable()
})
export type NagisaAnilistTitle = z.infer<typeof NagisaAnilistTitleSchema>

export const NagisaAnilistLookupSchema = z.object({
  anilist_id: z.number().int(),
  queue_available: z.boolean(),
  titles: z.array(NagisaAnilistTitleSchema)
})
export type NagisaAnilistLookup = z.infer<typeof NagisaAnilistLookupSchema>
