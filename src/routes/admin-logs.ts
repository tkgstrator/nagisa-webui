import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import { createPrismaClient } from '../lib/db'
import {
  LogStatsSchema,
  PaginatedSyncRunSchema,
  SyncRunDetailSchema,
  SyncRunListQuerySchema,
  type SyncRunSchema
} from '../schemas/log.dto'

type Bindings = {
  DB: D1Database
}

/**
 * wrangler.toml の [triggers] crons と 1:1 で対応させること。
 * ここに書いた式で sync_runs を引くので、wrangler.toml 側だけ変えると
 * 「一度も実行されていない cron」として UI に出る (それが狙い)。
 */
const CRON_DEFINITIONS = [
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
  droppedLogs: number
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
      const children = await prisma.syncRun.findMany({
        where: { parentId: id },
        orderBy: { startedAt: 'asc' },
        take: 100
      })
      return c.json({ run: serializeRun(run), children: children.map(serializeRun) }, 200)
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
              where: { kind: 'cron', trigger: d.cron },
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
