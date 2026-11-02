import { describe, expect, test } from 'bun:test'
import {
  fetchCardsWith,
  type GenrePage,
  type GenrePageFetcher,
  mergeCardLists,
  parseCards
} from '../../../src/lib/providers/abema/browse'
import { GenreCardsResponseSchema } from '../../../src/schemas/providers/abema.dto'

describe('abema cards', () => {
  test('missing cards key is a schema failure, not an empty success', () => {
    expect(GenreCardsResponseSchema.safeParse({ items: [] }).success).toBe(false)
  })

  test('invalid card is skipped without failing the rest', () => {
    const { cards, skipped } = parseCards([{ seriesId: 'a', title: 'A' }, { seriesId: '', title: 'B' }, null])
    expect(cards.map((c) => c.seriesId)).toEqual(['a'])
    expect(skipped).toBe(2)
  })
})

describe('abema fetchCardsWith', () => {
  const card = (id: string) => ({ seriesId: id, title: id })
  const page = (ids: string[], subGenreIds: string[] = [], next?: string): GenrePage => ({
    cards: ids.map(card),
    next,
    subGenreIds
  })

  test('mergeCardLists dedupes by seriesId', () => {
    const { cards } = parseCards([card('a'), card('b')])
    const { cards: more } = parseCards([card('b'), card('c')])
    expect(mergeCardLists([cards, more]).map((c) => c.seriesId)).toEqual(['a', 'b', 'c'])
  })

  test('merges animation and sub genres, dedupes, follows paging', async () => {
    const getPage: GenrePageFetcher = async (id, next) => {
      if (id === 'animation') return page(['a', 'b'], ['animation', 'sub1', 'sub2'])
      if (id === 'sub1') return next ? page(['d']) : page(['b', 'c'], [], 'p2')
      return page(['54-125'])
    }
    const cards = await fetchCardsWith(getPage, 2)
    expect(cards.map((c) => c.seriesId)).toEqual(['a', 'b', 'c', 'd', '54-125'])
  })

  test('sub genre failure does not fail the whole fetch', async () => {
    const getPage: GenrePageFetcher = async (id) => {
      if (id === 'animation') return page(['a'], ['bad', 'ok'])
      if (id === 'bad') throw new Error('429')
      return page(['z'])
    }
    expect((await fetchCardsWith(getPage)).map((c) => c.seriesId)).toEqual(['a', 'z'])
  })

  test('root genre failure throws', async () => {
    const getPage: GenrePageFetcher = async () => {
      throw new Error('boom')
    }
    await expect(fetchCardsWith(getPage)).rejects.toThrow('boom')
  })

  test('0 valid cards throws', async () => {
    const getPage: GenrePageFetcher = async () => ({ cards: [null], next: undefined, subGenreIds: [] })
    await expect(fetchCardsWith(getPage)).rejects.toThrow('0 valid cards')
  })
})
