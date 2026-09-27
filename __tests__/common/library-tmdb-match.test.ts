import { describe, expect, test } from 'bun:test'
import { indexTmdbEpisodes, matchKey, rowKey, tmdbKey } from '../../src/lib/library-sync/ledger'
import type { NagisaLibraryItem } from '../../src/schemas/nagisa.dto'

const item = (over: Partial<NagisaLibraryItem>): NagisaLibraryItem => ({
  provider: 'hulu',
  content_id: null,
  episode_id: null,
  season_number: 1,
  episode_number: 3,
  path: '[HL] The Mentalist (2008) [tmdbid-5920]/Season 01/S01E03.mkv',
  size: 1,
  mtime: null,
  tmdb_id: 5920,
  ...over
})

describe('rowKey', () => {
  test('id が揃っていれば id で引く (tmdb_id があっても)', () => {
    expect(rowKey(item({ content_id: '12345', episode_id: '67890' }))).toBe(matchKey('hulu', '12345', '67890'))
  })

  test('episode_id が無ければ tmdb_id とシーズン・話数で引く', () => {
    expect(rowKey(item({}))).toBe(tmdbKey('hulu', 5920, 1, 3))
  })

  test('content_id だけあっても episode_id が無ければ tmdb で引く', () => {
    expect(rowKey(item({ content_id: '12345' }))).toBe(tmdbKey('hulu', 5920, 1, 3))
  })

  test.each([
    ['provider が unknown', { provider: 'unknown' }],
    ['tmdb_id が null', { tmdb_id: null }],
    ['tmdb_id を送らない古い nagisa', { tmdb_id: undefined }],
    ['話数が無い', { episode_number: null }],
    ['シーズンが無い', { season_number: null }]
  ] as const)('%s なら引かない', (_, over) => {
    expect(rowKey(item(over))).toBeNull()
  })

  test('tmdb のキーは id のキーと衝突しない', () => {
    expect(tmdbKey('hulu', 1, 1, 1)).not.toBe(matchKey('hulu', '1', '1'))
  })
})

describe('indexTmdbEpisodes', () => {
  const ep = (
    id: string,
    over: { provider?: string; tmdbId?: number; seasonNumber?: number; episodeNumber?: number } = {}
  ) => ({
    id,
    provider: 'hulu',
    tmdbId: 5920,
    seasonNumber: 1,
    episodeNumber: 3,
    ...over
  })

  test('一意に当たるものだけ残る', () => {
    const index = indexTmdbEpisodes([ep('a'), ep('b', { episodeNumber: 4 })])
    expect(index.get(tmdbKey('hulu', 5920, 1, 3))).toEqual(['a'])
    expect(index.get(tmdbKey('hulu', 5920, 1, 4))).toEqual(['b'])
  })

  test('同じキーに 2 件当たったら捨てる', () => {
    const index = indexTmdbEpisodes([ep('a'), ep('b')])
    expect(index.has(tmdbKey('hulu', 5920, 1, 3))).toBe(false)
  })

  test('provider が違えば別のキー', () => {
    const index = indexTmdbEpisodes([ep('a'), ep('b', { provider: 'amazon' })])
    expect(index.get(tmdbKey('hulu', 5920, 1, 3))).toEqual(['a'])
    expect(index.get(tmdbKey('amazon', 5920, 1, 3))).toEqual(['b'])
  })
})
