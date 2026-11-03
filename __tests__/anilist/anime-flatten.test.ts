import { describe, expect, test } from 'bun:test'
import type { AnilistMedia } from '../../src/generated/prisma/client.ts'
import { deriveYearQuarterStatus } from '../../src/lib/anime-flatten'

const media = (over: Partial<AnilistMedia>): AnilistMedia =>
  ({
    id: 1,
    season: 'SPRING',
    seasonYear: 2026,
    status: 'RELEASING',
    startYear: 2026,
    startMonth: 4,
    endYear: null,
    endMonth: null,
    endDay: null,
    episodes: null,
    nextAiringAt: null,
    nextAiringEpisode: null,
    ...over
  }) as AnilistMedia

const now = new Date('2026-07-01T00:00:00Z')

describe('deriveYearQuarterStatus (放送中の導出)', () => {
  test('endDate が過去なら FINISHED', () => {
    expect(deriveYearQuarterStatus(media({ endYear: 2026, endMonth: 6, endDay: 20 }), now).status).toBe('FINISHED')
  })
  test('endDate が未来なら RELEASING のまま', () => {
    expect(deriveYearQuarterStatus(media({ endYear: 2026, endMonth: 9, endDay: 1 }), now).status).toBe('RELEASING')
  })
  test('endDate の当日中は RELEASING、UTC の翌日 0 時で FINISHED', () => {
    const am = media({ endYear: 2026, endMonth: 6, endDay: 30 })
    expect(deriveYearQuarterStatus(am, new Date('2026-06-30T23:59:59Z')).status).toBe('RELEASING')
    expect(deriveYearQuarterStatus(am, new Date('2026-07-01T00:00:00Z')).status).toBe('FINISHED')
  })
  test('day / month 欠けは月末 / 年末で見る', () => {
    expect(deriveYearQuarterStatus(media({ endYear: 2026, endMonth: 6 }), now).status).toBe('FINISHED')
    expect(deriveYearQuarterStatus(media({ endYear: 2026, endMonth: 7 }), now).status).toBe('RELEASING')
    expect(deriveYearQuarterStatus(media({ endYear: 2026 }), now).status).toBe('RELEASING')
  })
  test('endDate が null なら保存値のまま', () => {
    expect(deriveYearQuarterStatus(media({}), now).status).toBe('RELEASING')
  })
  test('最終話の放送時刻を過ぎていれば FINISHED', () => {
    const am = media({ episodes: 12, nextAiringEpisode: 12, nextAiringAt: new Date('2026-06-30T15:00:00Z') })
    expect(deriveYearQuarterStatus(am, now).status).toBe('FINISHED')
  })
  test('最終話より前の古い次回放送では FINISHED にしない', () => {
    const am = media({ episodes: 12, nextAiringEpisode: 8, nextAiringAt: new Date('2026-06-30T15:00:00Z') })
    expect(deriveYearQuarterStatus(am, now).status).toBe('RELEASING')
  })
  test('次回放送なし + 話数ありだけでは終了と見なさない', () => {
    expect(deriveYearQuarterStatus(media({ episodes: 12 }), now).status).toBe('RELEASING')
  })
  test('RELEASING 以外は触らない', () => {
    const am = media({ status: 'NOT_YET_RELEASED', endYear: 2020 })
    expect(deriveYearQuarterStatus(am, now).status).toBe('NOT_YET_RELEASED')
  })
})
