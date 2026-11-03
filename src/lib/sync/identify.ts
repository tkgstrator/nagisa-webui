import type { PrismaClient } from '../../generated/prisma/client.ts'
import type { TitleMetadata } from '../../schemas/providers/metadata.dto'
import { recordCatalogEvents } from '../catalog-event'
import type { FetchClient } from '../lambda'
import { getAppLogger } from '../logger'
import { animeUuid } from './ids'

const fetchLogger = getAppLogger('fetch')

/** Lambda /identify に 1 回で投げる件数の上限 (IdentifyRequestSchema の max 50 以内) */
export const LAMBDA_IDENTIFY_BATCH = 25

/**
 * D1 照合で識別できなかったタイトルだけ Lambda /identify に投げ、結果を元の並びにマージする。
 * Lambda の失敗は握りつぶさずログに残し、D1 照合の結果をそのまま返す (識別は次回に持ち越し)。
 * 返した aniListId の anilist_media 行は呼び出し側が requireAnilistMedia で保証する (完全な行は /anilist_status で取る)。
 * `allow[i]` が false のタイトルは問い合わせない (再識別の Lambda 呼び出し数を絞るため)。
 */
export async function fillFromLambda(
  lambda: Pick<FetchClient, 'identifyTitles'>,
  batch: { title: string }[],
  d1Results: (TitleMetadata | undefined)[],
  providerName: string,
  allow?: boolean[]
): Promise<(TitleMetadata | undefined)[]> {
  const missing = batch.flatMap((t, i) =>
    d1Results[i]?.aniListId == null && (allow?.[i] ?? true) ? [{ index: i, title: t.title }] : []
  )
  if (missing.length === 0) return d1Results
  try {
    const { results } = await lambda.identifyTitles({ titles: missing.map((m) => m.title) })
    const found = new Map(
      missing.flatMap((m, k): [number, TitleMetadata][] => {
        const hit = results[k]
        return hit?.aniListId == null
          ? []
          : [
              [
                m.index,
                { aniListId: hit.aniListId, title: hit.title, status: hit.status, year: hit.year, quarter: hit.quarter }
              ]
            ]
      })
    )
    fetchLogger.info({
      action: 'identify-lambda-fallback',
      provider: providerName,
      requested: missing.length,
      matched: found.size
    })
    return d1Results.map((r, i) => found.get(i) ?? r)
  } catch (e) {
    fetchLogger.error({
      action: 'identify-lambda-fallback-failed',
      provider: providerName,
      requested: missing.length,
      error: e instanceof Error ? e.message : String(e)
    })
    return d1Results
  }
}

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002'
}

export interface UnidentifiedRow {
  provider: string
  contentId: string
  imageUrl: string | null
}

/**
 * unidentified_anime の行を anime に昇格させ、unidentified 側の行を削除する。冪等。
 * 既に anime がある (競合) 場合は unidentified の削除だけ行う。
 * 呼び出し側は meta.aniListId の anilist_media 行が存在することを保証しておくこと。
 */
export async function promoteUnidentified(
  prisma: PrismaClient,
  row: UnidentifiedRow,
  meta: { aniListId: number; title: string }
): Promise<void> {
  const created = await prisma.anime
    .create({
      data: {
        id: animeUuid(row.provider, row.contentId),
        provider: row.provider,
        contentId: row.contentId,
        title: meta.title,
        description: '',
        entityType: 'tv',
        imageUrl: row.imageUrl ?? '',
        aniListId: meta.aniListId
      }
    })
    .catch((e: unknown) => {
      if (isUniqueConstraintError(e)) return null
      throw e
    })
  if (created) {
    await recordCatalogEvents(prisma, [
      {
        animeId: created.id,
        provider: row.provider,
        contentId: row.contentId,
        title: meta.title,
        kind: 'title-added'
      }
    ])
  }
  await prisma.unidentifiedAnime.deleteMany({ where: { provider: row.provider, contentId: row.contentId } })
}
