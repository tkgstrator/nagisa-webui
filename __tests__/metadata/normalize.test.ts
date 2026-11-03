import { describe, expect, test } from 'bun:test'
import { cleanTitle } from '../../src/lib/metadata/anilist'
import { type AnilistRow, pickMetadata } from '../../src/lib/metadata/local-anilist'
import { normalizeTitle } from '../../src/lib/metadata/normalize'

describe('normalizeTitle (NFKC)', () => {
  test.each([
    ['ダンジョンに出会いを求めるのは間違っているだろうかII', 'ダンジョンに出会いを求めるのは間違っているだろうかⅡ'],
    ['キン肉マンⅡ世', 'キン肉マンII世'],
    ['LUPIN THE ⅢRD', 'LUPIN THE IIIRD'],
    ['ｽﾄﾘｰﾄﾌｧｲﾀｰ', 'ストリートファイター'],
    ['⼠', '士'],
    ['A〜B', 'A～B'],
    ['FX戦士くるみちゃん', 'ＦＸ戦士くるみちゃん']
  ])('%s == %s', (a, b) => {
    expect(normalizeTitle(a)).toBe(normalizeTitle(b))
  })

  test('different works stay different', () => {
    expect(normalizeTitle('ドラゴンボール')).not.toBe(normalizeTitle('ドラゴンボールZ'))
  })
})

describe('cleanTitle wave dash', () => {
  test('removes 〜...〜 and ～...～ subtitles', () => {
    expect(cleanTitle('作品名 〜サブ〜')).toBe('作品名')
    expect(cleanTitle('作品名 ～サブ～')).toBe('作品名')
  })
})

describe('pickMetadata', () => {
  const base: AnilistRow = {
    id: 1,
    titleNative: 'x',
    season: 'FALL',
    seasonYear: 2026,
    status: 'RELEASING',
    startYear: 2026,
    startMonth: 10,
    nativeNorm: 'x',
    romajiNorm: null,
    englishNorm: null
  }
  test('falls back to the next candidate when the first cannot be converted', () => {
    const broken: AnilistRow = { ...base, id: 2, titleNative: null }
    expect(pickMetadata([broken, base])?.aniListId).toBe(1)
  })
  test('undefined when none convertible', () => {
    expect(pickMetadata([{ ...base, titleNative: null }])).toBeUndefined()
    expect(pickMetadata(undefined)).toBeUndefined()
  })
})
