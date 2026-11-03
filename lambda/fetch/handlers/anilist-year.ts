/**
 * `/anilist_year` ハンドラ。
 * AniList の 1 年分の anime media をページ単位で取得して返す。Workers の送信元は AniList に
 * 403 でブロックされるので、取得だけを Lambda に寄せ、DB への upsert は Worker 側で行う。
 *
 * 1 回の呼び出しで取るページ数は maxPages で区切り、続きは nextPage で呼び出し側が再度頼む。
 * (1 年あたり約 10 ページ × 1.5s なので、Lambda のタイムアウトを跨がないよう分割できる)
 */
import type { z } from 'zod'
import { fetchAnilistYearPage } from '../../../src/lib/metadata/anilist-fetch'
import type { FetchAnilistYearRequestSchema, FetchAnilistYearResponseSchema } from '../../../src/schemas/lambda.dto'
import { logger } from '../logger'
import { UpstreamError } from '../response'

type Request = z.output<typeof FetchAnilistYearRequestSchema>
type Response = z.infer<typeof FetchAnilistYearResponseSchema>

/** AniList の degrade rate limit (30/min) を踏まえた最低間隔 */
const REQUEST_INTERVAL_MS = 1500

/** fetchAnilistYearPage は `AniList <status>: ...` の message で throw する。status を取り出す。 */
function upstreamStatus(e: unknown): number | null {
  const m = e instanceof Error ? /^AniList (\d{3}):/.exec(e.message) : null
  return m ? Number(m[1]) : null
}

export async function fetchAnilistYear({ year, country, startPage, maxPages }: Request): Promise<Response> {
  const fetchPage = (page: number) =>
    fetchAnilistYearPage(year, page, country).catch((e: unknown) => {
      const status = upstreamStatus(e)
      if (status !== null) {
        logger.error({ action: 'anilist-year-error', year, page, status })
        throw new UpstreamError(status, e instanceof Error ? e.message : String(e))
      }
      throw e
    })

  /** page から順に取得し、結果を acc に畳み込む。maxPages 到達か年の終端で止まる。 */
  const collect = async (page: number, acc: Response): Promise<Response> => {
    if (acc.pages >= maxPages) return acc
    if (acc.pages > 0) await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS))
    const result = await fetchPage(page)
    const done = result.media.length === 0 || !result.hasNextPage
    const next: Response = {
      entries: [...acc.entries, ...result.media],
      pages: acc.pages + 1,
      nextPage: done ? null : page + 1
    }
    return done ? next : collect(page + 1, next)
  }

  const response = await collect(startPage, { entries: [], pages: 0, nextPage: null })
  logger.info({
    action: 'anilist-year',
    year,
    country,
    startPage,
    pages: response.pages,
    entries: response.entries.length,
    nextPage: response.nextPage
  })
  return response
}
