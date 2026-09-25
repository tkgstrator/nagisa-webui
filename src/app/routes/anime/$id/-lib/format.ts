import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { getIntlayer } from 'intlayer'
import { appLocale } from '@/app/lib/locale'

dayjs.extend(duration)

const content = getIntlayer('anime-id-format', appLocale)

export function formatDuration(seconds: number): string {
  const d = dayjs.duration(seconds, 'seconds')
  return d.hours() > 0 ? d.format('H:mm:ss') : d.format('m:ss')
}

/** ヒーロー領域の「総再生時間」向け。3時間36分 / 24分 の形にする。 */
export function formatRuntime(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? content.hoursMinutes({ hours: h, minutes: m }) : content.minutes({ minutes: m })
}

export function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('YYYY/MM/DD')
}

/** サイドバーの放送スケジュール向け。7/25 (金) の形にする。 */
export function formatMonthDay(dateStr: string): string {
  const d = dayjs(dateStr)
  return `${d.format('M/D')} (${content.weekday[d.day()]})`
}

export type EpisodeStatus = 'done' | 'todo' | 'future'

/**
 * エピソードの録画状態。API が持つのは recorded と配信日だけなので、
 * 録画済み / 未録画 / 配信予定 の3状態に落とす。
 */
export function episodeStatus(episode: { recorded: boolean; releaseDate: string }): EpisodeStatus {
  if (episode.recorded) return 'done'
  return dayjs(episode.releaseDate).isAfter(dayjs()) ? 'future' : 'todo'
}

/** タイトルごとに安定した色相を返す。サムネイル未取得時のプレースホルダに使う。 */
export function hueOf(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return hash
}

export function getWatchUrl(provider: string, episodeId: string): string | null {
  if (!episodeId) return null
  switch (provider) {
    case 'amazon':
      return `https://www.amazon.co.jp/gp/video/detail/${episodeId}`
    case 'hulu':
      return `https://www.hulu.jp/watch/${episodeId}`
    case 'crunchyroll':
      return `https://www.crunchyroll.com/watch/${episodeId}`
    case 'abema':
      return `https://abema.tv/video/episode/${episodeId}`
    default:
      return null
  }
}

export function getProviderTitleUrl(provider: string, contentId: string): string | null {
  if (!contentId) return null
  switch (provider) {
    case 'amazon':
      return `https://www.amazon.co.jp/gp/video/detail/${contentId}`
    case 'hulu':
      return `https://www.hulu.jp/${contentId}`
    case 'crunchyroll':
      return `https://www.crunchyroll.com/series/${contentId}`
    case 'abema':
      return `https://abema.tv/video/title/${contentId}`
    case 'netflix':
      return `https://www.netflix.com/title/${contentId}`
    default:
      return null
  }
}
