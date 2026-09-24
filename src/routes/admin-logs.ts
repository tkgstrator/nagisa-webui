import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { createPrismaClient } from '../lib/db'
import {
  type ObservabilityEnv,
  ObservabilityNotConfiguredError,
  ObservabilityUpstreamError,
  queryLogEntries
} from '../lib/observability'
import {
  CatalogEventFieldEnum,
  CatalogEventListQuerySchema,
  type CatalogEventSchema,
  CursoredLogEntrySchema,
  LogEntryListQuerySchema,
  LogStatsSchema,
  PaginatedCatalogEventSchema,
  PaginatedRecordingEventSchema,
  PaginatedSyncRunSchema,
  RecordingEventListQuerySchema,
  type RecordingEventSchema,
  SyncRunDetailSchema,
  SyncRunListQuerySchema,
  type SyncRunSchema
} from '../schemas/log.dto'

type Bindings = {
  DB: D1Database
} & ObservabilityEnv

/**
 * wrangler.toml の [triggers] crons と 1:1 で対応させること。
 * ここに書いた式で sync_runs を引くので、wrangler.toml 側だけ変えると
 * 「一度も実行されていない cron」として UI に出る (それが狙い)。
 *
 * `trigger` は sync_runs 側に入っている名前で、既定では cron 式そのもの。
 * 録画同期の 2 本だけは仕事の名前で記録している (→ `scheduled.ts`):
 * 何もしなかった tick を記録しない都合で startRun がハンドラ側にあり、
 * そこでは式ではなく仕事が分かっているため。
 */
const CRON_DEFINITIONS = [
  { cron: '* * * * *', trigger: 'job-sync', label: '毎分: 録画ジョブの追従' },
  { cron: '*/15 * * * *', trigger: 'library-sync', label: '15 分ごと: 録画台帳の差分取り込み' },
  { cron: '0 */1 * * *', label: '毎時: 新着 / 配信予定の取得' },
  { cron: '0 0 * * *', label: '毎日 0 時: 配信終了間近の取得' },
  { cron: '0 3 * * *', label: '毎日 3 時: カタログ全件の取得' },
  { cron: '0 4 * * *', label: '毎日 4 時: ABEMA 鍵アーカイブ' },
  { cron: '0 5 * * SUN', label: '毎週日曜 5 時: AniList 同期' }
] as const

type RunRow = {
  id: string
  kind: string
  trigger: string
  parentId: string | null
  status: string
  startedAt: Date
  finishedAt: Date | null
  durationMs: number | null
  total: number
  succeeded: number
  failed: number
  retried: number
  animeCreated: number
  animeUpdated: number
  errorMessage: string | null
  meta: string | null
}

function serializeRun(r: RunRow): SyncRunSchema {
  return {
    ...r,
    kind: r.kind as SyncRunSchema['kind'],
    status: r.status as SyncRunSchema['status'],
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt === null ? null : r.finishedAt.toISOString()
  }
}

type RecordingRow = {
  id: string
  animeId: string
  episodeId: string | null
  provider: string
  contentId: string
  title: string
  kind: string
  source: string
  status: string
  httpStatus: number | null
  episodeCount: number | null
  errorMessage: string | null
  runId: string | null
  createdAt: Date
}

function serializeRecording(r: RecordingRow): RecordingEventSchema {
  return {
    ...r,
    kind: r.kind as RecordingEventSchema['kind'],
    source: r.source as RecordingEventSchema['source'],
    status: r.status as RecordingEventSchema['status'],
    createdAt: r.createdAt.toISOString()
  }
}

type CatalogRow = {
  id: string
  animeId: string
  provider: string
  contentId: string
  title: string
  kind: string
  seasonNumber: number | null
  episodeCount: number | null
  episodes: string | null
  fields: string | null
  runId: string | null
  createdAt: Date
}

/** fields は JSON 配列の文字列で持っている。壊れていたら null に倒して一覧は落とさない */
function parseFields(raw: string | null): CatalogEventSchema['fields'] {
  if (raw === null) return null
  try {
    const parsed = z.array(CatalogEventFieldEnum).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function serializeCatalog(r: CatalogRow): CatalogEventSchema {
  return {
    ...r,
    kind: r.kind as CatalogEventSchema['kind'],
    fields: parseFields(r.fields),
    createdAt: r.createdAt.toISOString()
  }
}

/** run 詳細に載せる生ログの上限。1 バッチで数百行出るので全部は返さない */
const RUN_DETAIL_ENTRY_LIMIT = 200

/** Workers Logs の保持期間。run 詳細はこの範囲でだけ生ログを探す */
const LOG_RETENTION_HOURS = 168

function describeObservabilityError(e: unknown): string {
  if (e instanceof ObservabilityNotConfiguredError) return 'Workers Logs の読み取り設定が無い'
  if (e instanceof ObservabilityUpstreamError) return `Workers Logs の取得に失敗: ${e.message}`
  throw e
}

const adminLogs = new OpenAPIHono<{ Bindings: Bindings }>()

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/runs',
    tags: ['Admin'],
    summary: '同期ジョブの実行履歴 (cron / Queue バッチ / 手動)',
    request: { query: SyncRunListQuerySchema },
    responses: {
      200: {
        description: '実行履歴一覧',
        content: { 'application/json': { schema: PaginatedSyncRunSchema } }
      }
    }
  }),
  async (c) => {
    const { page, limit, kind, status, hours } = c.req.valid('query')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const where = {
        startedAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {})
      }
      const [total, rows] = await Promise.all([
        prisma.syncRun.count({ where }),
        prisma.syncRun.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ])
      return c.json(
        {
          data: rows.map(serializeRun),
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/runs/{id}',
    tags: ['Admin'],
    summary: '実行 1 件の詳細 (cron run なら子の Queue バッチも返す)',
    request: { params: z.object({ id: z.string().nonempty() }) },
    responses: {
      200: {
        description: '実行詳細',
        content: { 'application/json': { schema: SyncRunDetailSchema } }
      },
      404: {
        description: '該当する実行記録が無い',
        content: { 'application/json': { schema: z.object({ message: z.string() }) } }
      }
    }
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const run = await prisma.syncRun.findUnique({ where: { id } })
      if (run === null) {
        return c.json({ message: 'run not found' }, 404)
      }
      // 生ログは Workers Logs 側。取れなくても実行記録そのものは返す
      const [children, logs] = await Promise.all([
        prisma.syncRun.findMany({
          where: { parentId: id },
          orderBy: { startedAt: 'asc' },
          take: 100
        }),
        queryLogEntries(c.env, {
          limit: RUN_DETAIL_ENTRY_LIMIT,
          level: 'debug',
          runId: id,
          hours: LOG_RETENTION_HOURS
        }).then(
          (r) => ({ entries: r.data, entriesError: null }),
          (e: unknown) => ({ entries: [], entriesError: describeObservabilityError(e) })
        )
      ])
      return c.json(
        {
          run: serializeRun(run),
          children: children.map(serializeRun),
          ...logs
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/entries',
    tags: ['Admin'],
    summary: '生ログ (level は「以上」/ カーソルページング)',
    description: 'Workers Logs (Telemetry API) から引く。保持は 7 日。',
    request: { query: LogEntryListQuerySchema },
    responses: {
      200: {
        description: 'ログ一覧 (新しい順)',
        content: { 'application/json': { schema: CursoredLogEntrySchema } }
      },
      502: {
        description: 'Telemetry API の呼び出しに失敗',
        content: { 'application/json': { schema: z.object({ message: z.string() }) } }
      },
      503: {
        description: 'Workers Logs を読む設定 (secret / var) が無い',
        content: { 'application/json': { schema: z.object({ message: z.string() }) } }
      }
    }
  }),
  async (c) => {
    try {
      return c.json(await queryLogEntries(c.env, c.req.valid('query')), 200)
    } catch (e) {
      if (e instanceof ObservabilityNotConfiguredError) return c.json({ message: e.message }, 503)
      if (e instanceof ObservabilityUpstreamError) return c.json({ message: e.message }, 502)
      throw e
    }
  }
)

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/recordings',
    tags: ['Admin'],
    summary: '録画リクエストとその結末の時系列',
    description:
      '生ログ (/entries, 7 日) と違い 180 日残り、animeId で引ける。作品ページの「この作品の録画履歴」もここを見る。',
    request: { query: RecordingEventListQuerySchema },
    responses: {
      200: {
        description: '録画イベント一覧 (新しい順)',
        content: { 'application/json': { schema: PaginatedRecordingEventSchema } }
      }
    }
  }),
  async (c) => {
    const { page, limit, animeId, kind, status, hours } = c.req.valid('query')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const where = {
        createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
        ...(animeId ? { animeId } : {}),
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {})
      }
      const [total, rows] = await Promise.all([
        prisma.recordingEvent.count({ where }),
        prisma.recordingEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ])
      return c.json(
        {
          data: rows.map(serializeRecording),
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/catalog',
    tags: ['Admin'],
    summary: 'カタログに入った変化 (新規タイトル / シーズン / エピソード追加・更新) の時系列',
    description: 'バッジや配信終了の出入りは載せない。エピソードの追加・更新は 1 回の同期につき作品単位で 1 行。',
    request: { query: CatalogEventListQuerySchema },
    responses: {
      200: {
        description: 'カタログ変化の一覧 (新しい順)',
        content: { 'application/json': { schema: PaginatedCatalogEventSchema } }
      }
    }
  }),
  async (c) => {
    const { page, limit, animeId, kind, provider, hours } = c.req.valid('query')
    const prisma = createPrismaClient(c.env.DB)
    try {
      const where = {
        createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
        ...(animeId ? { animeId } : {}),
        ...(kind ? { kind } : {}),
        ...(provider ? { provider } : {})
      }
      const [total, rows] = await Promise.all([
        prisma.catalogEvent.count({ where }),
        prisma.catalogEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        })
      ])
      return c.json(
        {
          data: rows.map(serializeCatalog),
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

adminLogs.openapi(
  createRoute({
    method: 'get',
    path: '/stats',
    tags: ['Admin'],
    summary: 'cron 式ごとの最終実行 (wrangler.toml の定義と突き合わせる)',
    responses: {
      200: {
        description: 'cron の稼働状況',
        content: { 'application/json': { schema: LogStatsSchema } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const [lastRuns, counts] = await Promise.all([
        Promise.all(
          CRON_DEFINITIONS.map((d) =>
            prisma.syncRun.findFirst({
              where: { kind: 'cron', trigger: 'trigger' in d ? d.trigger : d.cron },
              orderBy: { startedAt: 'desc' }
            })
          )
        ),
        prisma.syncRun.groupBy({
          by: ['status'],
          where: { startedAt: { gte: since } },
          _count: { _all: true }
        })
      ])
      const countOf = (status: string) => counts.find((x) => x.status === status)?._count._all ?? 0
      return c.json(
        {
          crons: CRON_DEFINITIONS.map((d, i) => {
            const last = lastRuns[i]
            return {
              cron: d.cron,
              label: d.label,
              everRan: last !== null,
              lastRun: last === null ? null : serializeRun(last)
            }
          }),
          recent: {
            total: counts.reduce((acc, x) => acc + x._count._all, 0),
            success: countOf('success'),
            partial: countOf('partial'),
            failed: countOf('failed'),
            running: countOf('running')
          }
        },
        200
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

export default adminLogs
