import type { PrismaClient } from '../../generated/prisma/client.ts'
import type { TitleMetadata } from '../../schemas/providers/metadata.dto'
import { recordCatalogEvents } from '../catalog-event'
import type { FetchClient } from '../lambda'
import { getAppLogger } from '../logger'
import { normalizeTitle } from '../metadata/normalize'
import { animeUuid } from './ids'

const fetchLogger = getAppLogger('fetch')

/** Lambda /identify に 1 回で投げる件数の上限 (IdentifyRequestSchema の max 50 以内) */
export const LAMBDA_IDENTIFY_BATCH = 25

/** TitleMetadata.quarter (0..3) → AniList season */
const QUARTER_TO_SEASON = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const

/**
 * Lambda /identify が返した作品の anilist_media 行を、無ければ最小限の内容で作る。
 * Anime.anilistMedia は必須関係 (DB に FK は無い) で、行が無いまま anime を作ると include の
 * クエリが壊れるため。既にある行 (年次同期で入った完全な行) は触らない。
 * syncedAt は epoch にして「年次同期で上書きされるまでの仮行」と分かるようにし、
 * anilist_media の最終 synced_at (停止検知) を仮行で更新しないようにする。
 */
async function ensureStubMedia(prisma: PrismaClient, meta: TitleMetadata & { aniListId: number }): Promise<void> {
  const norm = normalizeTitle(meta.title) || null
  await prisma.anilistMedia.upsert({
    where: { id: meta.aniListId },
    create: {
      id: meta.aniListId,
      titleNative: meta.title,
      nativeNorm: norm,
      season: QUARTER_TO_SEASON[meta.quarter] ?? null,
      seasonYear: meta.year,
      status: meta.status,
      startYear: meta.year,
      syncedAt: new Date(0)
    },
    update: {}
  })
}

/**
 * D1 照合で識別できなかったタイトルだけ Lambda /identify に投げ、結果を元の並びにマージする。
 * Lambda の失敗は握りつぶさずログに残し、D1 照合の結果をそのまま返す (識別は次回に持ち越し)。
 * anilist_media の行を用意できなかった識別結果は未識別 (undefined) のままにする。
 * `allow[i]` が false のタイトルは問い合わせない (再識別の Lambda 呼び出し数を絞るため)。
 */
export async function fillFromLambda(
  prisma: PrismaClient,
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
      await Promise.all(
        missing.map(async (m, k): Promise<readonly [number, TitleMetadata | undefined]> => {
          const hit = results[k]
          if (!hit || hit.aniListId == null) return [m.index, undefined]
          const meta = {
            aniListId: hit.aniListId,
            title: hit.title,
            status: hit.status,
            year: hit.year,
            quarter: hit.quarter
          }
          try {
            await ensureStubMedia(prisma, meta)
            return [m.index, meta]
          } catch (e) {
            fetchLogger.error({
              action: 'identify-lambda-media-failed',
              provider: providerName,
              aniListId: hit.aniListId,
              error: e instanceof Error ? e.message : String(e)
            })
            return [m.index, undefined]
          }
        })
      )
    )
    fetchLogger.info({
      action: 'identify-lambda-fallback',
      provider: providerName,
      requested: missing.length,
      matched: [...found.values()].filter(Boolean).length
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
