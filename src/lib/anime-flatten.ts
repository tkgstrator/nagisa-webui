/**
 * Anime + AnilistMedia の relational fetch 結果を、フロント DTO 互換の
 * フラットな形 (year/quarter/status を anime 直下に持つ) に変換する。
 *
 * anime テーブルからは year/quarter/status を削除し、anilist_media を
 * 権威ソースにしているため、API レスポンス組み立て時にここで JOIN 結果を平坦化する。
 */
import type { AnilistMedia, Anime } from '../generated/prisma/client.ts'

const SEASON_TO_QUARTER: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const MONTH_TO_QUARTER = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] as const
export const QUARTER_TO_SEASON = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const

export type AnimeWithAnilistMedia = Anime & { anilistMedia: AnilistMedia }

export interface AnimeFlatExtras {
  year: number
  quarter: number
  status: string
}

/**
 * 終了日の「その日の終わり」(UTC) の時刻。day / month が欠けていれば月末 / 年末で見る。
 * 最終話がその日の夜 (UTC では同日内) に放送されても、日が変わるまでは終了と見なさない。
 */
function endOfEndDateUtc(am: AnilistMedia): number | null {
  if (am.endYear == null) return null
  const month = am.endMonth ?? 12
  // Date.UTC は day=0 で前月末日になるので、翌月/翌年の 1 日 0 時 = 終了日の翌日 0 時
  const dayAfter = am.endDay != null ? Date.UTC(am.endYear, month - 1, am.endDay + 1) : Date.UTC(am.endYear, month, 1)
  return dayAfter
}

/**
 * AniList の更新が遅れていても、保存済みの情報から放送終了と言えるか。
 * - 終了日 (UTC) が過去
 * - 最終話 (nextAiringEpisode.episode が全話数以上) の放送時刻を過ぎている
 * 「次回放送なし」だけでは中断・未定との区別がつかないので終了とは見なさない。
 */
export function isAiringOver(am: AnilistMedia, now: Date): boolean {
  const endBoundary = endOfEndDateUtc(am)
  if (endBoundary !== null && endBoundary <= now.getTime()) return true
  return (
    am.episodes != null &&
    am.nextAiringEpisode != null &&
    am.nextAiringAt != null &&
    am.nextAiringEpisode >= am.episodes &&
    am.nextAiringAt.getTime() <= now.getTime()
  )
}

export function deriveYearQuarterStatus(am: AnilistMedia, now: Date = new Date()): AnimeFlatExtras {
  const year = am.seasonYear ?? am.startYear ?? 0
  const quarter = am.season
    ? (SEASON_TO_QUARTER[am.season] ?? 0)
    : am.startMonth != null
      ? MONTH_TO_QUARTER[am.startMonth - 1]
      : 0
  const status = am.status === 'RELEASING' && isAiringOver(am, now) ? 'FINISHED' : am.status
  return { year, quarter, status }
}

export function flattenAnime<T extends AnimeWithAnilistMedia>(row: T): Omit<T, 'anilistMedia'> & AnimeFlatExtras {
  const { anilistMedia, ...rest } = row
  return { ...rest, ...deriveYearQuarterStatus(anilistMedia) }
}
