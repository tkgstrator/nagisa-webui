import { getIntlayer } from 'intlayer'
import { providerLabel } from '@/app/lib/constants'
import type { AnimeSchema } from '@/schemas/anime.dto'
import { daysUntil } from '../-components/format'
import { RECORDED_OPTIONS, type RecordedFilter } from '../-components/recordings-toolbar'

const content = getIntlayer('recordings-summary')

export type RecordingsSummary = {
  recorded: number
  pending: number
  expiring: number
  expiringSoonestDays: number | null
}

/** 表示中のページから算出するサマリ。総数以外はサーバー側で集計できないため。 */
export const summarize = (anime: AnimeSchema[], expiringLeadDays: number): RecordingsSummary => {
  const recorded = anime.filter((item) => item.recorded).length
  /** 「配信終了予定」に数えるのは、設定した日数以内に終わるものだけ。 */
  const expiringDays = anime
    .filter((item) => item.expiredAt !== null)
    .map((item) => daysUntil(item.expiredAt as string))
    .filter((days) => days <= expiringLeadDays)
  return {
    recorded,
    pending: anime.length - recorded,
    expiring: expiringDays.length,
    expiringSoonestDays: expiringDays.length === 0 ? null : Math.min(...expiringDays)
  }
}

type ActiveFilterTermsParams = {
  search: string
  provider: string | undefined
  recordedFilter: RecordedFilter
  expiringOnly: boolean
}

/** 空表示に並べる、適用中の条件ラベル。 */
export const activeFilterTerms = ({
  search,
  provider,
  recordedFilter,
  expiringOnly
}: ActiveFilterTermsParams): string[] => {
  const terms: string[] = []
  if (search.trim().length > 0) terms.push(content.searchTerm({ search: search.trim() }))
  if (provider !== undefined) terms.push(providerLabel[provider] ?? provider)
  if (recordedFilter !== 'all') {
    terms.push(RECORDED_OPTIONS.find((opt) => opt.value === recordedFilter)?.label ?? recordedFilter)
  }
  if (expiringOnly) terms.push(content.expiringOnly)
  return terms
}
