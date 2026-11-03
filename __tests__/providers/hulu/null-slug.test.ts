import { describe, expect, test } from 'bun:test'
import { parseEpisodesFromHtml } from '../../../src/lib/providers/hulu/detail'

const episode = (n: number, slug: string | null) => ({
  id: 1000 + n,
  id_in_schema: 2000 + n,
  title: `作品 シーズン1 第${n}話`,
  description: 'あらすじ',
  slug,
  imageUrl: 'https://images.prod.hjholdings.tv/x/uploads/a.png?w=331&h=447&q=80',
  rental: false,
  startAt: '2026/10/06 22:00:00',
  endAt: '2027/12/31 23:59:59',
  isLogin: false,
  schema_key: 'asset',
  model_id: `asset:${2000 + n}`,
  additionalInfo: {
    card_info: {
      episode_number_title: `第${n}話`,
      has_closed_caption: false,
      has_en_caption: false,
      has_ja_caption: false,
      season_number_title: 'シーズン1'
    },
    episode_runtime: 1425.049,
    schema_key: 'asset',
    series_id: 500,
    service: 'hulu',
    short_name: `サブタイトル${n}`,
    slug
  }
})

/** RSC ストリーミングチャンクに包んだ HTML を作る */
const rscHtml = (metas: unknown[]) => {
  const payload = `x:{"metas":${JSON.stringify(metas)}}`
  return `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`
}

describe('parseEpisodesFromHtml: slug が null のエピソード', () => {
  test('slug: null の 5 件をすべてパースできる', () => {
    const episodes = parseEpisodesFromHtml(rscHtml([1, 2, 3, 4, 5].map((n) => episode(n, null))))
    expect(episodes).toHaveLength(5)
    expect(episodes.every((e) => e.slug === null)).toBe(true)
  })

  test('不正な 1 件は skip し、残りを返す', () => {
    const broken = { ...episode(3, null), startAt: undefined }
    const episodes = parseEpisodesFromHtml(rscHtml([episode(1, null), episode(2, 'a'), broken]))
    expect(episodes.map((e) => e.id_in_schema)).toEqual([2001, 2002])
  })

  test('全件不正なら throw する (黙って空にしない)', () => {
    expect(() => parseEpisodesFromHtml(rscHtml([{ foo: 1 }]))).toThrow()
  })
})
