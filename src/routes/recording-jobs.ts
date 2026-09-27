import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import type { NagisaEnv } from '../lib/nagisa-client'
import { enqueueRecording } from '../lib/record-enqueue'
import { NagisaEnqueueRequestSchema, NagisaEnqueueResponseSchema } from '../schemas/nagisa.dto'

type Bindings = NagisaEnv & { DB: D1Database }

/** 録画ジョブの投入。作品単位の投入は `/anime/{id}/recording-jobs` (routes/anime/record.ts) 側。 */
const recordingJobs = new OpenAPIHono<{ Bindings: Bindings }>()

/** 上流が受け付けなかった / 設定が無い場合の共通レスポンス形。 */
const ErrorSchema = z.object({ error: z.string().nonempty(), status: z.number().int().optional() })

recordingJobs.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Recording Jobs'],
    summary: '録画サーバーへ単体ジョブを直接投入する (CF Access はサーバ側で付与)',
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
        description: '録画サーバーが受け付けなかった',
        content: { 'application/json': { schema: ErrorSchema } }
      }
    }
  }),
  async (c) => {
    const result = await enqueueRecording(createPrismaClient(c.env.DB), c.env, c.req.valid('json'))
    if (!result.ok) return c.json({ error: result.error, status: result.status }, 502 as const)
    return c.json(result.data, 200)
  }
)

export default recordingJobs
