import { describe, expect, test } from 'bun:test'
import { type AnimeStatusKey, type AnimeStatusTone, deriveAnimeStatus } from '../../src/lib/anime-status'

describe('deriveAnimeStatus', () => {
  const cases: [string, boolean, AnimeStatusKey, AnimeStatusTone][] = [
    ['FINISHED', true, 'completed', 'success'],
    ['FINISHED', false, 'incomplete', 'warning'],
    ['RELEASING', true, 'recording', 'info'],
    ['RELEASING', false, 'recording', 'info'],
    ['NOT_YET_RELEASED', false, 'upcoming', 'muted'],
    ['NOT_YET_RELEASED', true, 'upcoming', 'muted'],
    ['HIATUS', false, 'hiatus', 'muted'],
    ['CANCELLED', false, 'cancelled', 'destructive'],
    ['CANCELLED', true, 'cancelled', 'destructive']
  ]
  test.each(cases)('%s / recorded=%p -> %s', (status, recorded, key, tone) => {
    const derived = deriveAnimeStatus({ status, recorded })
    expect(derived.key).toBe(key)
    expect(derived.tone).toBe(tone)
  })

  test('unknown status keeps the raw string with muted tone', () => {
    expect(deriveAnimeStatus({ status: 'SOMETHING_NEW', recorded: true })).toEqual({
      key: null,
      raw: 'SOMETHING_NEW',
      tone: 'muted'
    })
  })
})
