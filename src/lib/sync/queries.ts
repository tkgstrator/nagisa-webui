import type { PrismaClient } from '../../generated/prisma/client.ts'

/**
 * IN 句のチャンクサイズ。
 *
 * D1 の bound parameter 上限は **1 クエリ 100 個**で、SQLite 既定の 999 とは別物。
 * 101 個目から `[7500] too many SQL variables` で落ちる
 * (`scripts/analysis/d1-param-limit-probe.ts` で実測)。
 *
 * 100 ちょうどにしないのは、この定数を使う呼び出しが IN 句以外にも変数を持つため。
 * 最も余裕がないのは `expiredAt` リセットの updateMany で `chunk + 3` になる。
 */
export const D1_VARIABLE_LIMIT = 90

export async function findExistingContentIds(
  prisma: PrismaClient,
  provider: string,
  contentIds: string[]
): Promise<Set<string>> {
  const results: string[] = []
  for (let i = 0; i < contentIds.length; i += D1_VARIABLE_LIMIT) {
    const chunk = contentIds.slice(i, i + D1_VARIABLE_LIMIT)
    const rows = await prisma.anime.findMany({
      where: { provider, contentId: { in: chunk } },
      select: { contentId: true }
    })
    results.push(...rows.map((r) => r.contentId))
  }
  return new Set(results)
}

/**
 * AniList 識別済み (anime に登録済み) の contentId を返す。
 * unidentified_anime は「既知」に含めない: 含めると識別失敗が固定化され二度と再識別されない。
 */
export async function findKnownContentIds(
  prisma: PrismaClient,
  provider: string,
  contentIds: string[]
): Promise<Set<string>> {
  const found: string[] = []
  for (let i = 0; i < contentIds.length; i += D1_VARIABLE_LIMIT) {
    const chunk = contentIds.slice(i, i + D1_VARIABLE_LIMIT)
    const rows = await prisma.anime.findMany({
      where: { provider, contentId: { in: chunk } },
      select: { contentId: true }
    })
    found.push(...rows.map((r) => r.contentId))
  }
  return new Set(found)
}

/** 過去に識別へ失敗して unidentified_anime にある contentId を返す (再識別の対象) */
export async function findUnidentifiedContentIds(
  prisma: PrismaClient,
  provider: string,
  contentIds: string[]
): Promise<Set<string>> {
  const found: string[] = []
  for (let i = 0; i < contentIds.length; i += D1_VARIABLE_LIMIT) {
    const chunk = contentIds.slice(i, i + D1_VARIABLE_LIMIT)
    const rows = await prisma.unidentifiedAnime.findMany({
      where: { provider, contentId: { in: chunk } },
      select: { contentId: true }
    })
    found.push(...rows.map((r) => r.contentId))
  }
  return new Set(found)
}
