import { getIntlayer } from 'intlayer'
import type { BrowseFilters } from '@/app/lib/atoms'
import { providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'

const content = getIntlayer('browse-filters', appLocale)

const PAGE_SIZE = 24

const QUARTER_LABEL = [
  content.quarters.winter,
  content.quarters.spring,
  content.quarters.summer,
  content.quarters.autumn
] as const

const STATUS_LABEL: Record<string, string> = {
  RELEASING: content.status.releasing,
  FINISHED: content.status.finished,
  NOT_YET_RELEASED: content.status.notYetReleased,
  CANCELLED: content.status.cancelled,
  HIATUS: content.status.hiatus
}

const BADGE_LABEL: Record<string, string> = {
  NEW_EPISODE: content.badge.newEpisode,
  RECENTLY_ADDED: content.badge.recentlyAdded,
  COMING_SOON: content.badge.comingSoon,
  EXPIRING: content.badge.expiring
}

/** チップのドット色。配信元のチップだけブランド色を点で示す。 */
const PROVIDER_DOT: Record<string, string> = {
  amazon: 'bg-brand-amazon-foreground',
  hulu: 'bg-brand-hulu-foreground',
  crunchyroll: 'bg-brand-crunchyroll-foreground',
  abema: 'bg-brand-abema-foreground',
  netflix: 'bg-brand-netflix-foreground'
}

export const SORT_OPTIONS = [
  { value: 'title-asc', label: content.sort.titleAsc, sort: 'title' as const, order: 'asc' as const },
  { value: 'title-desc', label: content.sort.titleDesc, sort: 'title' as const, order: 'desc' as const },
  { value: 'year-desc', label: content.sort.yearDesc, sort: 'year' as const, order: 'desc' as const },
  { value: 'year-asc', label: content.sort.yearAsc, sort: 'year' as const, order: 'asc' as const }
] as const

export type SortValue = (typeof SORT_OPTIONS)[number]['value']

/** ルート loader が取得するのと同一のクエリ。絞り込み前の総件数をキャッシュから読むために使う。 */
export const baseListQuery = { page: 1, limit: PAGE_SIZE, sort: 'title' as const, order: 'asc' as const }

export type ActiveChip = {
  key: string
  label: string
  value: string
  dot?: string
  query?: boolean
  onClear: () => void
}

/** `setFilter` と同じ形。チップの解除は絞り込み state を直接触らず、呼び出し元から渡してもらう。 */
type SetFilter = <K extends keyof BrowseFilters>(key: K) => (value: BrowseFilters[K]) => void

export type BuildActiveChipsParams = {
  provider: string | undefined
  year: number | undefined
  quarter: number | undefined
  status: string | undefined
  badge: string | undefined
  aniListId: number | undefined
  search: string
  setFilter: SetFilter
}

export function buildActiveChips({
  provider,
  year,
  quarter,
  status,
  badge,
  aniListId,
  search,
  setFilter
}: BuildActiveChipsParams): ActiveChip[] {
  return [
    provider != null
      ? {
          key: 'provider',
          label: content.chips.provider,
          value: providerLabel[provider] ? providerLabel[provider] : provider,
          dot: PROVIDER_DOT[provider],
          onClear: () => setFilter('provider')(undefined)
        }
      : null,
    year != null
      ? {
          key: 'year',
          label: content.chips.year,
          value: `${year}`,
          onClear: () => setFilter('year')(undefined)
        }
      : null,
    quarter != null
      ? {
          key: 'quarter',
          label: content.chips.quarter,
          value: QUARTER_LABEL[quarter] ? QUARTER_LABEL[quarter] : '',
          onClear: () => setFilter('quarter')(undefined)
        }
      : null,
    status != null
      ? {
          key: 'status',
          label: content.chips.status,
          value: STATUS_LABEL[status] ? STATUS_LABEL[status] : status,
          onClear: () => setFilter('status')(undefined)
        }
      : null,
    badge != null
      ? {
          key: 'badge',
          label: content.chips.badge,
          value: BADGE_LABEL[badge] ? BADGE_LABEL[badge] : badge,
          onClear: () => setFilter('badge')(undefined)
        }
      : null,
    aniListId != null
      ? {
          key: 'aniListId',
          label: content.chips.relatedSeries,
          value: `${aniListId}`,
          onClear: () => setFilter('aniListId')(undefined)
        }
      : null,
    search !== ''
      ? {
          key: 'search',
          label: content.chips.search,
          value: search,
          query: true,
          onClear: () => setFilter('search')('')
        }
      : null
  ].filter((v) => v !== null)
}
