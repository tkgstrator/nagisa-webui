import dayjs from 'dayjs'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type { TitleMetadata } from '../../schemas/providers/metadata.dto'
import type { FetchClient } from '../lambda'
import { getAppLogger } from '../logger'
import { ANILIST_IDS_CHUNK } from '../metadata/anilist-fetch'
import { upsertEntry } from '../metadata/anilist-sync'
import { D1_VARIABLE_LIMIT } from './queries'

const logger = getAppLogger('sync')

export type MediaLambda = Pick<FetchClient, 'identifyTitles' | 'fetchAnilistStatus'>

/**
 * 指定した AniList id の anilist_media 行を保証し、行が存在する id の集合を返す。
 * Anime.anilistMedia は必須関係 (DB に FK は無い) なので、行が無いまま anime を作ると
 * include: { anilistMedia: true } のクエリが壊れる。無い id だけ Lambda /anilist_status で取って upsert する。
 * 取得できなかった id (Lambda 失敗・AniList に存在しない) は戻り値に含めない。
 */
export async function ensureAnilistMedia(
  prisma: PrismaClient,
  lambda: Pick<FetchClient, 'fetchAnilistStatus'>,
  ids: number[]
): Promise<Set<number>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Set()
  const existing = new Set<number>()
  for (let i = 0; i < unique.length; i += D1_VARIABLE_LIMIT) {
    const rows = await prisma.anilistMedia.findMany({
      where: { id: { in: unique.slice(i, i + D1_VARIABLE_LIMIT) } },
      select: { id: true }
    })
    for (const r of rows) existing.add(r.id)
  }
  const missing = unique.filter((id) => !existing.has(id))
  for (let i = 0; i < missing.length; i += ANILIST_IDS_CHUNK) {
    const chunk = missing.slice(i, i + ANILIST_IDS_CHUNK)
    try {
      const { entries } = await lambda.fetchAnilistStatus({ ids: chunk })
      const syncedAt = dayjs().toDate()
      for (const e of entries) {
        await upsertEntry(prisma, e, e.countryOfOrigin ?? 'JP', syncedAt)
        existing.add(e.id)
      }
    } catch (e) {
      logger.error({
        action: 'ensure-anilist-media-failed',
        requested: chunk.length,
        error: e instanceof Error ? e.message : String(e)
      })
    }
  }
  const lost = unique.filter((id) => !existing.has(id))
  if (lost.length > 0) logger.warn({ action: 'ensure-anilist-media-missing', ids: lost })
  return existing
}

/** anilist_media の行を確保できなかった識別結果は未識別 (undefined) に戻す */
export async function requireAnilistMedia(
  prisma: PrismaClient,
  lambda: Pick<FetchClient, 'fetchAnilistStatus'>,
  results: (TitleMetadata | undefined)[]
): Promise<(TitleMetadata | undefined)[]> {
  const ok = await ensureAnilistMedia(
    prisma,
    lambda,
    results.flatMap((r) => (r?.aniListId != null ? [r.aniListId] : []))
  )
  return results.map((r) => (r?.aniListId != null && !ok.has(r.aniListId) ? undefined : r))
}
