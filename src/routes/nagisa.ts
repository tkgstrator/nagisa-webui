import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import { getAppLogger } from '../lib/logger'
import { fetchNagisaRaw, NagisaConfigError, type NagisaEnv } from '../lib/nagisa-client'
import { enqueueRecording } from '../lib/record-enqueue'
import {
  NagisaEnqueueRequestSchema,
  NagisaEnqueueResponseSchema,
  NagisaLibraryStatsSchema,
  NagisaQueueSnapshotSchema,
  NagisaStatusSchema
} from '../schemas/nagisa.dto'
import { RecordingSyncStateSchema, type RecordStatus, RecordStatusEnum } from '../schemas/recording.dto'

const logger = getAppLogger('routes')

type Bindings = NagisaEnv & { DB: D1Database }

const nagisa = new OpenAPIHono<{ Bindings: Bindings }>()

/** 上流が落ちている / 設定が無い場合の共通レスポンス形。 */
const ErrorSchema = z.object({ error: z.string().nonempty(), status: z.number().int().optional() })

/**
 * GET プロキシの共通部分。Nagisa の JSON をそのまま返すだけの経路が 3 本あり、
 * どれも「設定が無い」「繋がらない」「上流が 2xx 以外」で 502 に畳む挙動は同じ。
 * 差分を潰す先は本文の形だけなので、呼び出し側で型を当てる。
 */
async function proxyGet(
  env: Bindings,
  path: string,
  action: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
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

nagisa.openapi(
  createRoute({
    method: 'get',
    path: '/status',
    tags: ['Nagisa'],
    summary: 'Nagisaサーバーのステータスを取得',
    responses: {
      200: {
        description: 'Nagisaステータス',
        content: { 'application/json': { schema: NagisaStatusSchema } }
      },
      502: {
        description: 'Nagisaサーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyGet(c.env, '/api/status', 'nagisa-status')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaStatusSchema>, 200)
  }
)

nagisa.openapi(
  createRoute({
    method: 'get',
    path: '/queue/snapshot',
    tags: ['Nagisa'],
    summary: 'Nagisa のキューが今どのジョブを抱えているかを取得',
    description:
      'jobs に居ないジョブは「完了した」ではなく「Redis の保持期間から落ちた」でもありうる。' +
      '完了の唯一の根拠は台帳 (GET /api/library/changes) の upsert イベントであって、これではない。',
    responses: {
      200: {
        description: 'キューのスナップショット',
        content: { 'application/json': { schema: NagisaQueueSnapshotSchema } }
      },
      502: {
        description: 'Nagisaサーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyGet(c.env, '/api/queue/snapshot', 'nagisa-queue-snapshot')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaQueueSnapshotSchema>, 200)
  }
)

nagisa.openapi(
  createRoute({
    method: 'get',
    path: '/library/stats',
    tags: ['Nagisa'],
    summary: 'Nagisa の録画台帳の集計を取得',
    description: 'epoch / last_seq は WebUI 側のカーソルがどれだけ遅れているかを見るために使う。',
    responses: {
      200: {
        description: '台帳の集計',
        content: { 'application/json': { schema: NagisaLibraryStatsSchema } }
      },
      502: {
        description: 'Nagisaサーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyGet(c.env, '/api/library/stats', 'nagisa-library-stats')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaLibraryStatsSchema>, 200)
  }
)

nagisa.openapi(
  createRoute({
    method: 'post',
    path: '/jobs',
    tags: ['Nagisa'],
    summary: 'Nagisa の /api/queues へ単体ジョブを直接投入する (CF Access はサーバ側で付与)',
    request: {
      body: {
        content: {
          'application/json': { schema: NagisaEnqueueRequestSchema }
        }
      }
    },
    responses: {
      200: {
        description: '投入されたジョブ',
        content: { 'application/json': { schema: NagisaEnqueueResponseSchema } }
      },
      502: {
        description: 'Nagisa サーバーが受け付けなかった',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await enqueueRecording(createPrismaClient(c.env.DB), c.env, c.req.valid('json'), 'manual')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data, 200)
  }
)

nagisa.openapi(
  createRoute({
    method: 'get',
    path: '/sync-state',
    tags: ['Nagisa'],
    summary: 'ローカル側の同期状態 (カーソル / ロック / 状態の内訳) を取得',
    description:
      '上流には一切触らない。「WebUI が持っている録画状態がどこまで追いついているか」を返す経路なので、' +
      'nagisa が落ちていても 200 を返す (むしろ落ちているときこそ lastSucceededAt が要る)。',
    responses: {
      200: {
        description: '同期状態',
        content: { 'application/json': { schema: RecordingSyncStateSchema } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)

    // 状態の内訳は groupBy 1 文。**0 件の状態も必ず埋める**こと: 欠けたまま返すと
    // 「その状態が 0 件」と「集計が取れていない」が WebUI から区別できない。
    const [state, grouped, tracked, lastJobSync] = await Promise.all([
      prisma.syncState.findUnique({ where: { key: 'library' } }),
      prisma.episode.groupBy({ by: ['recordStatus'], _count: { _all: true } }),
      prisma.episode.count({
        where: { recordStatus: { in: ['pending', 'downloading'] }, recordJobId: { not: null } }
      }),
      prisma.syncRun.findFirst({
        where: { kind: 'cron', trigger: 'job-sync', status: 'success' },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true }
      })
    ])

    const counts = Object.fromEntries(RecordStatusEnum.options.map((s) => [s, 0])) as Record<RecordStatus, number>
    for (const row of grouped) {
      // record_status は文字列カラムなので、enum に無い値が入っていても落とさない
      // (手で書き換えた行などは黙って捨てる — 集計の欠けより静かな方がまし)。
      const parsed = RecordStatusEnum.safeParse(row.recordStatus)
      if (parsed.success) counts[parsed.data] = row._count._all
    }

    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
    return c.json(
      {
        cursor: state?.libraryCursor ?? null,
        snapshotCursor: state?.snapshotCursor ?? null,
        snapshotStartedAt: iso(state?.snapshotStartedAt),
        lastSucceededAt: iso(state?.lastSucceededAt),
        lastJobSyncAt: iso(lastJobSync?.startedAt),
        leaseUntil: iso(state?.leaseUntil),
        leaseOwner: state?.leaseOwner ?? null,
        counts,
        tracked
      },
      200
    )
  }
)

export default nagisa
