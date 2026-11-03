import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { getAutoScheduleNewEpisodes, setAutoScheduleNewEpisodes } from '../lib/app-settings'
import { createPrismaClient } from '../lib/db'
import { RecordingSettingsSchema } from '../schemas/settings.dto'

const settings = new OpenAPIHono<{ Bindings: { DB: D1Database } }>()

const jsonBody = { 'application/json': { schema: RecordingSettingsSchema } }

settings.openapi(
  createRoute({
    method: 'get',
    path: '/recording',
    tags: ['Settings'],
    summary: '録画設定 (サーバー保存) を取得',
    responses: { 200: { description: '録画設定', content: jsonBody } }
  }),
  async (c) => {
    const prisma = createPrismaClient(c.env.DB)
    return c.json({ autoScheduleNewEpisodes: await getAutoScheduleNewEpisodes(prisma) }, 200)
  }
)

settings.openapi(
  createRoute({
    method: 'put',
    path: '/recording',
    tags: ['Settings'],
    summary: '録画設定 (サーバー保存) を更新',
    request: { body: { required: true, content: jsonBody } },
    responses: { 200: { description: '更新後の録画設定', content: jsonBody } }
  }),
  async (c) => {
    const body = c.req.valid('json')
    const prisma = createPrismaClient(c.env.DB)
    await setAutoScheduleNewEpisodes(prisma, body.autoScheduleNewEpisodes)
    return c.json({ autoScheduleNewEpisodes: body.autoScheduleNewEpisodes }, 200)
  }
)

export default settings
