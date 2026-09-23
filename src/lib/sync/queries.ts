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

export async function findExistingContentIds(prisma: PrismaClient, contentIds: string[]): Promise<Set<string>> {
  const results: string[] = []
  for (let i = 0; i < contentIds.length; i += D1_VARIABLE_LIMIT) {
    const chunk = contentIds.slice(i, i + D1_VARIABLE_LIMIT)
    const rows = await prisma.anime.findMany({
      where: { contentId: { in: chunk } },
      select: { contentId: true }
    })
    results.push(...rows.map((r) => r.contentId))
  }
  return new Set(results)
}

/** AniList 識別済みかどうかに関わらず、過去に sync 試行済みの contentId を返す */
export async function findKnownContentIds(
  prisma: PrismaClient,
  provider: string,
  contentIds: string[]
): Promise<Set<string>> {
  const identified: string[] = []
  const unidentified: string[] = []
  for (let i = 0; i < contentIds.length; i += D1_VARIABLE_LIMIT) {
    const chunk = contentIds.slice(i, i + D1_VARIABLE_LIMIT)
    const [identifiedRows, unidentifiedRows] = await Promise.all([
      prisma.anime.findMany({
        where: { provider, contentId: { in: chunk } },
        select: { contentId: true }
      }),
      prisma.unidentifiedAnime.findMany({
        where: { provider, contentId: { in: chunk } },
        select: { contentId: true }
      })
    ])
    identified.push(...identifiedRows.map((r) => r.contentId))
    unidentified.push(...unidentifiedRows.map((r) => r.contentId))
  }
  return new Set([...identified, ...unidentified])
}
