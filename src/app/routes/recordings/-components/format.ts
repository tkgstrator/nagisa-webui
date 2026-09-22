import dayjs from 'dayjs'
import { QuarterLabel } from '@/schemas/anime.dto'

/** 「12 分前」「1 週間前」のような相対表記。dayjs のロケールを全体で書き換えたくないので自前で組む。 */
export const formatRelative = (value: string): string => {
  const target = dayjs(value)
  if (!target.isValid()) return '—'
  const minutes = dayjs().diff(target, 'minute')
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes} 分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 時間前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 日前`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} 週間前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} か月前`
  return `${Math.floor(days / 365)} 年前`
}

/** 「9/18 14:20」。相対表記の下に置く絶対時刻。 */
export const formatAbsolute = (value: string): string => {
  const target = dayjs(value)
  return target.isValid() ? target.format('M/D HH:mm') : '—'
}

/** 「9/30」。配信終了日。 */
export const formatDate = (value: string): string => {
  const target = dayjs(value)
  return target.isValid() ? target.format('M/D') : '—'
}

/** 今日から指定日までの残り日数。過ぎていれば 0。 */
export const daysUntil = (value: string): number => {
  const target = dayjs(value)
  if (!target.isValid()) return 0
  return Math.max(0, target.startOf('day').diff(dayjs().startOf('day'), 'day'))
}

/** 「2026年 夏」。年・クールのどちらも無ければ null。 */
export const seasonLabel = (year: number | null | undefined, quarter: number | null | undefined): string | null => {
  if (year === null || year === undefined) return null
  const label = quarter === null || quarter === undefined ? undefined : QuarterLabel[quarter]
  return label === undefined ? `${year}年` : `${year}年 ${label}`
}
