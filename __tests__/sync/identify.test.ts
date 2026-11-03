import { describe, expect, test } from 'bun:test'
import { fillFromLambda } from '../../src/lib/sync/identify'

const d1Hit = { aniListId: 1, title: 'd1', status: 'FINISHED', year: 2020, quarter: 0 } as const
const lambdaHit = {
  aniListId: 206401,
  title: 'FX戦士くるみちゃん',
  status: 'RELEASING',
  year: 2026,
  quarter: 2
} as const

describe('fillFromLambda', () => {
  test('only D1 misses are sent to Lambda and merged in order', async () => {
    const sent: string[][] = []
    const lambda = {
      identifyTitles: async ({ titles }: { titles: string[] }) => {
        sent.push(titles)
        return { results: [lambdaHit] }
      }
    }
    const out = await fillFromLambda(
      lambda,
      [{ title: 'a' }, { title: 'FX戦士くるみちゃん' }],
      [d1Hit, undefined],
      'abema'
    )
    expect(sent).toEqual([['FX戦士くるみちゃん']])
    expect(out[0]).toEqual(d1Hit)
    expect(out[1]).toMatchObject({ aniListId: 206401, status: 'RELEASING' })
  })

  test('no Lambda call when everything matched in D1', async () => {
    const lambda = {
      identifyTitles: async () => {
        throw new Error('should not be called')
      }
    }
    const out = await fillFromLambda(lambda, [{ title: 'a' }], [d1Hit], 'abema')
    expect(out).toEqual([d1Hit])
  })

  test('Lambda failure keeps D1 results', async () => {
    const lambda = {
      identifyTitles: async () => {
        throw new Error('Lambda invocation failed: 403')
      }
    }
    const out = await fillFromLambda(lambda, [{ title: 'a' }], [undefined], 'abema')
    expect(out).toEqual([undefined])
  })
})
