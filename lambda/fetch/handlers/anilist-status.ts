/**
 * `/anilist_status` ハンドラ。
 * AniList の media を id_in でまとめて取得して返す。放送中 (RELEASING / NOT_YET_RELEASED) の行を
 * 年・国に依存せず再取得するためのもので、DB への upsert は Worker 側で行う。
 * (Workers の送信元は AniList に 403 でブロックされるので取得だけを Lambda に寄せる)
 */
import type { z } from 'zod'
import { fetchAnilistByIds } from '../../../src/lib/metadata/anilist-fetch'
import type { FetchAnilistStatusResponseSchema } from '../../../src/schemas/lambda.dto'
import { logger } from '../logger'
import { UpstreamError } from '../response'

type Response = z.infer<typeof FetchAnilistStatusResponseSchema>

export async function fetchAnilistStatus(ids: number[]): Promise<Response> {
  const result = await fetchAnilistByIds(ids).catch((e: unknown) => {
    const m = e instanceof Error ? /^AniList (\d{3}):/.exec(e.message) : null
    if (m) {
      logger.error({ action: 'anilist-status-error', count: ids.length, status: Number(m[1]) })
      throw new UpstreamError(Number(m[1]), e instanceof Error ? e.message : String(e))
    }
    throw e
  })
  logger.info({ action: 'anilist-status', requested: ids.length, entries: result.media.length })
  return { entries: result.media }
}
