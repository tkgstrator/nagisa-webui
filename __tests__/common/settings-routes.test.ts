import { describe, expect, mock, test } from 'bun:test'
import { RecordingSettingsSchema } from '../../src/schemas/settings.dto'

const store = new Map<string, string>()
mock.module('../../src/lib/db', () => ({
  createPrismaClient: () => ({
    appSetting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
      upsert: async ({ where, update }: { where: { key: string }; update: { value: string } }) => {
        store.set(where.key, update.value)
      }
    }
  })
}))

const { default: settings } = await import('../../src/routes/settings')
const env = { DB: {} }
const put = (body: unknown) =>
  settings.request(
    '/recording',
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    env
  )

describe('settings routes', () => {
  test('未保存の既定は ON', async () => {
    const res = await settings.request('/recording', {}, env)
    expect(RecordingSettingsSchema.parse(await res.json())).toEqual({ autoScheduleNewEpisodes: true })
  })

  test('PUT で保存し GET に反映される', async () => {
    expect((await put({ autoScheduleNewEpisodes: false })).status).toBe(200)
    const res = await settings.request('/recording', {}, env)
    expect(RecordingSettingsSchema.parse(await res.json())).toEqual({ autoScheduleNewEpisodes: false })
  })

  test('不正な body は 400', async () => {
    expect((await put({ autoScheduleNewEpisodes: 'yes' })).status).toBe(400)
  })
})
