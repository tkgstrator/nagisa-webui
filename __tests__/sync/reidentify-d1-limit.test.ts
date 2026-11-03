import { afterAll, describe, expect, test } from 'bun:test'
import { identifyTitlesViaD1 } from '../../src/lib/metadata/local-anilist'
import { reidentifyUnidentified } from '../../src/lib/sync/reidentify'
import { createLimitedDb } from './d1-limit'

const lambda = {
  fetchAnilistStatus: async () => ({ entries: [] }),
  identifyTitles: async (body: { titles: string[] }) => ({ results: body.titles.map(() => null) })
}

const titles = (n: number) => Array.from({ length: n }, (_, i) => `テスト作品${i} 第2期`)

const t = await createLimitedDb()

describe('D1 bind variable limit (100 per query)', () => {
  afterAll(() => t.close())

  test('identifyTitlesViaD1 stays under the limit for 200 titles', async () => {
    await identifyTitlesViaD1(t.prisma, titles(200))
    const max = Math.max(...t.binds.map((b) => b.count))
    console.log(`max binds per query: ${max}`)
    expect(max).toBeLessThan(100)
  })

  test.each([100, 200])('reidentifyUnidentified processes %d rows', async (n) => {
    t.reset()
    await t.prisma.unidentifiedAnime.createMany({
      data: titles(n).map((title, i) => ({
        id: `id${String(i).padStart(4, '0')}`,
        provider: 'abema',
        contentId: `c${i}`,
        title
      }))
    })
    const result = await reidentifyUnidentified(t.prisma, lambda, { limit: n })
    expect(result.processed).toBe(n)
  })
})
