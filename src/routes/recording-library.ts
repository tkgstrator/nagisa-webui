import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import { type LibrarySyncResult, syncLibrary } from '../lib/library-sync'
import { SYNC_KEY } from '../lib/library-sync/limits'
import { createStore, flushLogs, runWithCapture } from '../lib/log-capture'
import { getAppLogger } from '../lib/logger'
import { type NagisaEnv, proxyNagisaGet } from '../lib/nagisa-client'
import { finishRun, startRun } from '../lib/sync-run'
import { NagisaLibraryStatsSchema } from '../schemas/nagisa.dto'
import {
  LibraryManualSyncResponseSchema,
  RecordingSyncStateSchema,
  type RecordStatus,
  RecordStatusEnum
} from '../schemas/recording.dto'

const logger = getAppLogger('routes')

type Bindings = NagisaEnv & { DB: D1Database }

/**
 * 録画台帳 (recording library)。上流の集計 (`/stats`) と、その台帳を D1 へ写した
 * ローカル側の同期状態 (`/sync-state`) / 手動同期 (`/sync`) をまとめる。
 */
const recordingLibrary = new OpenAPIHono<{ Bindings: Bindings }>()

/** 上流が落ちている / 設定が無い場合の共通レスポンス形。 */
const ErrorSchema = z.object({ error: z.string().nonempty(), status: z.number().int().optional() })

recordingLibrary.openapi(
  createRoute({
    method: 'get',
    path: '/stats',
    tags: ['Recording Library'],
    summary: '録画台帳の集計を取得',
    description: 'epoch / last_seq は WebUI 側のカーソルがどれだけ遅れているかを見るために使う。',
    responses: {
      200: {
        description: '台帳の集計',
        content: { 'application/json': { schema: NagisaLibraryStatsSchema } }
      },
      502: {
        description: '録画サーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyNagisaGet(c.env, '/api/library/stats', 'recording-library-stats')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaLibraryStatsSchema>, 200)
  }
)

recordingLibrary.openapi(
  createRoute({
    method: 'get',
    path: '/sync-state',
    tags: ['Recording Library'],
    summary: 'ローカル側の同期状態 (カーソル / ロック / 状態の内訳) を取得',
    description:
      '上流には一切触らない。「WebUI が持っている録画状態がどこまで追いついているか」を返す経路なので、' +
      '録画サーバーが落ちていても 200 を返す (むしろ落ちているときこそ lastSucceededAt が要る)。',
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
    const [state, grouped, tracked] = await Promise.all([
      prisma.syncState.findUnique({ where: { key: 'library' } }),
      prisma.episode.groupBy({ by: ['recordStatus'], _count: { _all: true } }),
      prisma.episode.count({
        where: { recordStatus: { in: ['pending', 'downloading'] }, recordJobId: { not: null } }
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
        leaseUntil: iso(state?.leaseUntil),
        leaseOwner: state?.leaseOwner ?? null,
        counts,
        tracked
      },
      200
    )
  }
)

recordingLibrary.openapi(
  createRoute({
    method: 'post',
    path: '/sync',
    tags: ['Recording Library'],
    summary: '録画台帳を D1 へ手動でフル同期する',
    description:
      'bootstrap が進行中でない限り、台帳を頭から取り直す (force)。既に bootstrap の途中であれば' +
      '二重に頭から取り直さず、その続きを読むだけに留める (`syncLibrary` の state 分岐に委ねる)。' +
      '`runId` は SyncRun の保存に失敗したときだけ null になる (同期自体はその場合も走る)。',
    responses: {
      200: {
        description: '同期結果',
        content: { 'application/json': { schema: LibraryManualSyncResponseSchema } }
      }
    }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)

    // bootstrap の継続印が残っていなければ force する。残っていれば syncLibrary 自身が
    // 続きを読むので、ここで force すると二重に頭から取り直してしまう。
    const before = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
    const force = !(before?.snapshotCursor || before?.snapshotStartedAt)

    const runId = await startRun(prisma, { kind: 'manual', trigger: 'library-sync' })
    const store = createStore(runId)
    let result: LibrarySyncResult | undefined

    try {
      await runWithCapture(store, async () => {
        result = await syncLibrary(prisma, c.env, { force })
        if (result.error) {
          logger.warn({ action: 'library-manual-sync-error', error: result.error })
        }
      })
    } finally {
      // flushLogs → finishRun の順を守る (src/lib/db.ts のクライアント使い回し都合)。
      const droppedLogs = await flushLogs(prisma, store)
      const touched = (result?.upserts ?? 0) + (result?.deletes ?? 0)
      // aborted (mass_delete / epoch 変更) は「落ちてはいないが適用していない」なので partial。
      const status = result?.error ? 'failed' : result?.aborted ? 'partial' : 'success'
      await finishRun(prisma, runId, status, {
        total: touched,
        succeeded: touched,
        failed: result?.error ? 1 : 0,
        droppedLogs,
        errorMessage: result?.error ?? result?.aborted ?? undefined,
        meta: {
          force,
          pages: result?.pages ?? 0,
          upserts: result?.upserts ?? 0,
          deletes: result?.deletes ?? 0,
          unmatched: result?.unmatched ?? 0,
          bootstrap: result?.bootstrap ?? null,
          aborted: result?.aborted ?? null
        }
      })
    }

    // 実行後の状態を読み直す。force しなかった (=bootstrap 継続中だった) 場合はもちろん、
    // force した run が MAX_SNAPSHOT_PAGES_PER_RUN で打ち切られた場合もここが非 null になる。
    const after = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
    const bootstrapInProgress = Boolean(after?.snapshotCursor || after?.snapshotStartedAt)

    return c.json(
      {
        runId,
        skipped: result?.skipped ?? false,
        bootstrap: result?.bootstrap ?? null,
        pages: result?.pages ?? 0,
        upserts: result?.upserts ?? 0,
        deletes: result?.deletes ?? 0,
        unmatched: result?.unmatched ?? 0,
        aborted: result?.aborted ?? null,
        error: result?.error ?? null,
        bootstrapInProgress
      },
      200
    )
  }
)

export default recordingLibrary
