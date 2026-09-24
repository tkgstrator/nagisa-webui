import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { type NagisaEnv, proxyNagisaGet } from '../lib/nagisa-client'
import { NagisaQueueSnapshotSchema, NagisaStatusSchema } from '../schemas/nagisa.dto'

type Bindings = NagisaEnv & { DB: D1Database }

/**
 * 録画サーバー (recorder) そのものの状態。上流の JSON を素通しするだけで、
 * ローカル D1 には触らない。
 */
const recorder = new OpenAPIHono<{ Bindings: Bindings }>()

/** 上流が落ちている / 設定が無い場合の共通レスポンス形。 */
const ErrorSchema = z.object({ error: z.string().nonempty(), status: z.number().int().optional() })

recorder.openapi(
  createRoute({
    method: 'get',
    path: '/status',
    tags: ['Recorder'],
    summary: '録画サーバーのステータスを取得',
    responses: {
      200: {
        description: '録画サーバーのステータス',
        content: { 'application/json': { schema: NagisaStatusSchema } }
      },
      502: {
        description: '録画サーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyNagisaGet(c.env, '/api/status', 'recorder-status')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaStatusSchema>, 200)
  }
)

recorder.openapi(
  createRoute({
    method: 'get',
    path: '/queue/snapshot',
    tags: ['Recorder'],
    summary: '録画サーバーのキューが今どのジョブを抱えているかを取得',
    description:
      'jobs に居ないジョブは「完了した」ではなく「Redis の保持期間から落ちた」でもありうる。' +
      '完了の唯一の根拠は台帳 (GET /api/library/changes) の upsert イベントであって、これではない。',
    responses: {
      200: {
        description: 'キューのスナップショット',
        content: { 'application/json': { schema: NagisaQueueSnapshotSchema } }
      },
      502: {
        description: '録画サーバーに接続できない',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await proxyNagisaGet(c.env, '/api/queue/snapshot', 'recorder-queue-snapshot')
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data as z.infer<typeof NagisaQueueSnapshotSchema>, 200)
  }
)

export default recorder
