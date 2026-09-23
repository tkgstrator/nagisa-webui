import type { BrowseFilters } from '@/app/lib/atoms'
import { providerLabel } from '@/app/lib/constants'

const PAGE_SIZE = 24

const QUARTER_LABEL = ['冬', '春', '夏', '秋'] as const

const STATUS_LABEL: Record<string, string> = {
  RELEASING: '放送中',
  FINISHED: '完結',
  NOT_YET_RELEASED: '未放送',
  CANCELLED: '中止',
  HIATUS: '休止'
}

const BADGE_LABEL: Record<string, string> = {
  NEW_EPISODE: '新着エピソード',
  RECENTLY_ADDED: '新着追加',
  COMING_SOON: '配信予定',
  EXPIRING: '配信終了予定'
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
  { value: 'title-asc', label: 'タイトル 昇順', sort: 'title' as const, order: 'asc' as const },
  { value: 'title-desc', label: 'タイトル 降順', sort: 'title' as const, order: 'desc' as const },
  { value: 'year-desc', label: 'リリース年 新しい順', sort: 'year' as const, order: 'desc' as const },
  { value: 'year-asc', label: 'リリース年 古い順', sort: 'year' as const, order: 'asc' as const }
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
          label: '配信元',
          value: providerLabel[provider] ? providerLabel[provider] : provider,
          dot: PROVIDER_DOT[provider],
          onClear: () => setFilter('provider')(undefined)
        }
      : null,
    year != null
      ? {
          key: 'year',
          label: '年',
          value: `${year}`,
          onClear: () => setFilter('year')(undefined)
        }
      : null,
    quarter != null
      ? {
          key: 'quarter',
          label: 'クール',
          value: QUARTER_LABEL[quarter] ? QUARTER_LABEL[quarter] : '',
          onClear: () => setFilter('quarter')(undefined)
        }
      : null,
    status != null
      ? {
          key: 'status',
          label: 'ステータス',
          value: STATUS_LABEL[status] ? STATUS_LABEL[status] : status,
          onClear: () => setFilter('status')(undefined)
        }
      : null,
    badge != null
      ? {
          key: 'badge',
          label: 'バッジ',
          value: BADGE_LABEL[badge] ? BADGE_LABEL[badge] : badge,
          onClear: () => setFilter('badge')(undefined)
        }
      : null,
    aniListId != null
      ? {
          key: 'aniListId',
          label: '関連シリーズ',
          value: `${aniListId}`,
          onClear: () => setFilter('aniListId')(undefined)
        }
      : null,
    search !== ''
      ? {
          key: 'search',
          label: '検索',
          value: search,
          query: true,
          onClear: () => setFilter('search')('')
        }
      : null
  ].filter((v) => v !== null)
}
