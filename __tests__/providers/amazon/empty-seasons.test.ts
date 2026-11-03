import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { fetchAmazonTitleDetail } from '../../../src/lib/providers/amazon/detail'

const CONTENT_ID = 'B0TESTCONT'
const IMG = 'https://m.media-amazon.com/images/S/pv-target-images/x.jpg'

const header = (seasonNumber?: number) => ({
  title: 'テスト作品',
  synopsis: 'あらすじ',
  entityType: 'TV Show',
  images: { covershot: '', titleshot: IMG, packshot: IMG },
  ratingBadge: { displayText: '13+' },
  subtitles: [],
  audioTracks: [],
  releaseDate: '2026年1月5日',
  ...(seasonNumber === undefined ? {} : { seasonNumber })
})

/** atf.state.seasons が空 {} のページ (実ページの構造を最小化したもの) */
const pageHtml = (seasonNumber: number | undefined, tokens: string[]) => {
  const json = {
    init: {
      preparations: {
        body: {
          atf: { state: { detail: { headerDetail: { CATALOG1: header(seasonNumber) } }, seasons: {} } },
          btf: { state: { episodeList: { actions: { episodePages: tokens.map((token) => ({ token })) } } } }
        }
      }
    }
  }
  return `<html><script type="application/json">${JSON.stringify(json)}</script></html>`
}

const widgetBody = (count: number) => ({
  widgets: {
    episodeList: {
      episodes: Array.from({ length: count }, (_, i) => ({
        titleID: `B0EP${i + 1}`,
        detail: {
          episodeNumber: i + 1,
          title: `第${i + 1}話`,
          synopsis: 'あらすじ',
          releaseDate: '2026年1月5日',
          duration: 1400,
          images: { covershot: '', titleshot: IMG, packshot: IMG }
        }
      }))
    }
  }
})

const mockFetch = (html: string, episodes: number) =>
  spyOn(globalThis, 'fetch').mockImplementation((async (input: Request | string | URL) => {
    const url = String(input)
    if (url.includes('getDetailWidgets')) return Response.json(widgetBody(episodes))
    return new Response(html)
  }) as typeof fetch)

afterEach(() => {
  ;(globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.()
})

describe('fetchAmazonTitleDetail: atf.state.seasons が空のページ', () => {
  test('ページ自身を 1 シーズンとして扱いエピソードを取得する', async () => {
    mockFetch(pageHtml(2, ['tok1']), 3)
    const info = await fetchAmazonTitleDetail(CONTENT_ID)
    expect(info.seasons).toHaveLength(1)
    expect(info.seasons[0].seasonId).toBe(CONTENT_ID)
    expect(info.seasons[0].seasonNumber).toBe(2)
    expect(info.seasons[0].displayName).toBe('シーズン2')
    expect(info.seasons[0].episodes.map((e) => e.episodeNumber)).toEqual([1, 2, 3])
  })

  test('headerDetail.seasonNumber が無ければシーズン1', async () => {
    mockFetch(pageHtml(undefined, ['tok1']), 1)
    const info = await fetchAmazonTitleDetail(CONTENT_ID)
    expect(info.seasons[0].seasonNumber).toBe(1)
    expect(info.seasons[0].displayName).toBe('シーズン1')
  })
})
