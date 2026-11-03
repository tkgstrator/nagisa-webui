import type { PrismaClient } from '../../generated/prisma/client.ts'
import type { TitleMetadata } from '../../schemas/providers/metadata.dto'
import { getAppLogger } from '../logger'
import { identifyTitlesViaD1 } from '../metadata/local-anilist'
import { type MediaLambda, requireAnilistMedia } from './ensure-media'
import { fillFromLambda, LAMBDA_IDENTIFY_BATCH, promoteUnidentified } from './identify'

const logger = getAppLogger('sync')

/** 1 メッセージで処理する unidentified_anime の既定件数 */
export const REIDENTIFY_CHUNK = 100

export interface ReidentifyResult {
  processed: number
  identified: number
  /** 今回 anime に昇格した行。呼び出し側が update ジョブを積む */
  promoted: { provider: string; contentId: string }[]
  /** 次に処理すべき行の手前の id。null なら最後まで処理した */
  nextCursor: string | null
}

/**
 * unidentified_anime を id 昇順で `limit` 件だけ引き直す (D1 照合 → 外れた分だけ Lambda /identify)。
 * 識別できた行は anime に昇格して unidentified から削除する。冪等で、cursor 以降を続きから処理する。
 * 4,000 件超あるので 1 回で全件は回さず、呼び出し側が nextCursor で次メッセージを積む。
 */
export async function reidentifyUnidentified(
  prisma: PrismaClient,
  lambda: MediaLambda,
  options: { cursor?: string; limit?: number } = {}
): Promise<ReidentifyResult> {
  const limit = options.limit ?? REIDENTIFY_CHUNK
  const rows = await prisma.unidentifiedAnime.findMany({
    where: options.cursor ? { id: { gt: options.cursor } } : undefined,
    orderBy: { id: 'asc' },
    take: limit,
    select: { id: true, provider: true, contentId: true, title: true, imageUrl: true }
  })
  if (rows.length === 0) return { processed: 0, identified: 0, promoted: [], nextCursor: null }

  const d1Results = await identifyTitlesViaD1(
    prisma,
    rows.map((r) => r.title)
  )
  // Lambda には D1 で外れた行だけを LAMBDA_IDENTIFY_BATCH ずつ投げる。
  // 識別できた行の anilist_media は promote 前に requireAnilistMedia が /anilist_status で完全な行にする (取れなければ未識別のまま)
  const filledAll = await Array.from({ length: Math.ceil(rows.length / LAMBDA_IDENTIFY_BATCH) }, (_, k) => k).reduce(
    async (accP, k) => {
      const acc = await accP
      const from = k * LAMBDA_IDENTIFY_BATCH
      const slice = rows.slice(from, from + LAMBDA_IDENTIFY_BATCH)
      const filled = await fillFromLambda(lambda, slice, d1Results.slice(from, from + slice.length), 'reidentify')
      return [...acc, ...filled]
    },
    Promise.resolve<(TitleMetadata | undefined)[]>([])
  )
  const merged = await requireAnilistMedia(prisma, lambda, filledAll)

  const promoted = await rows.reduce(async (accP, row, i) => {
    const acc = await accP
    const meta = merged[i]
    if (meta?.aniListId == null) return acc
    await promoteUnidentified(prisma, row, { aniListId: meta.aniListId, title: meta.title })
    return [...acc, { provider: row.provider, contentId: row.contentId }]
  }, Promise.resolve<{ provider: string; contentId: string }[]>([]))
  const identified = promoted.length

  const last = rows.at(-1)
  logger.info({ action: 'reidentify-chunk-done', processed: rows.length, identified, cursor: options.cursor ?? null })
  return {
    processed: rows.length,
    identified,
    promoted,
    nextCursor: rows.length === limit && last ? last.id : null
  }
}
