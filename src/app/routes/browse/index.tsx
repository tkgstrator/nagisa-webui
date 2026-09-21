import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { AnimeDrawer } from '@/app/components/anime-drawer'
import { SidebarSlot } from '@/app/components/app-sidebar'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { SmartPagination } from '@/app/components/smart-pagination'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { type BrowseFilters, browseFiltersAtom, browseFiltersDefaults } from '@/app/lib/atoms'
import { providerLabel } from '@/app/lib/constants'
import { animeListQueryOptions } from '@/app/lib/query-options'
import { type CardDensity, useSettings } from '@/app/routes/settings/-lib/settings'
import { ProviderTypeEnum } from '@/schemas/message.dto'
import { AnimeCard } from './-components/anime-card'
import { BrowseFilterPanel } from './-components/browse-filters'
import { SearchBar } from './-components/search-bar'

const PAGE_SIZE = 24

/** 表示件数の選択肢。決定稿モックの .perpage と同じ 3 段。 */
const PAGE_SIZE_OPTIONS = [24, 48, 96] as const

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

/** 表示密度ごとの列数と間隔。`default` は決定稿モックのままの値。 */
const DENSITY_GRID: Record<CardDensity, string> = {
  comfortable: 'grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-sm:gap-x-3 max-sm:gap-y-4',
  default:
    'grid-cols-2 gap-x-4 gap-y-[18px] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 max-sm:gap-x-2.5 max-sm:gap-y-3.5',
  compact: 'grid-cols-3 gap-x-3 gap-y-3.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 max-sm:gap-x-2 max-sm:gap-y-2.5'
}

/** チップのドット色。配信元のチップだけブランド色を点で示す。 */
const PROVIDER_DOT: Record<string, string> = {
  amazon: 'bg-brand-amazon-foreground',
  hulu: 'bg-brand-hulu-foreground',
  crunchyroll: 'bg-brand-crunchyroll-foreground',
  abema: 'bg-brand-abema-foreground',
  netflix: 'bg-brand-netflix-foreground'
}

const SORT_OPTIONS = [
  { value: 'title-asc', label: 'タイトル 昇順', sort: 'title' as const, order: 'asc' as const },
  { value: 'title-desc', label: 'タイトル 降順', sort: 'title' as const, order: 'desc' as const },
  { value: 'year-desc', label: 'リリース年 新しい順', sort: 'year' as const, order: 'desc' as const },
  { value: 'year-asc', label: 'リリース年 古い順', sort: 'year' as const, order: 'asc' as const }
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

/** ルート loader が取得するのと同一のクエリ。絞り込み前の総件数をキャッシュから読むために使う。 */
const baseListQuery = { page: 1, limit: PAGE_SIZE, sort: 'title' as const, order: 'asc' as const }

type ActiveChip = { key: string; label: string; value: string; dot?: string; query?: boolean; onClear: () => void }

export const Route = createFileRoute('/browse/')({
  validateSearch: z.object({
    provider: ProviderTypeEnum.optional(),
    badge: z.string().optional(),
    q: z.string().optional()
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(animeListQueryOptions(baseListQuery)),
  pendingComponent: LoadingSpinner,
  component: AnimeListPage
})

function AnimeListPage() {
  const { provider: searchProvider, badge: searchBadge, q: searchQuery } = Route.useSearch()
  const [filters, setFilters] = useAtom(browseFiltersAtom)
  const { settings } = useSettings()
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (searchQuery === undefined) return
    if (filters.search === searchQuery) return
    setFilters((prev) => ({ ...prev, search: searchQuery, page: 1 }))
  }, [searchQuery, filters.search, setFilters])

  const provider = searchProvider !== undefined ? searchProvider : filters.provider
  const badge = searchBadge !== undefined ? searchBadge : filters.badge

  const setFilter = useCallback(
    <K extends keyof BrowseFilters>(key: K) =>
      (value: BrowseFilters[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? (value as number) : 1 }))
      },
    [setFilters]
  )

  /** 表示件数は URL にも atom にも無ければ設定の既定値を使う。 */
  const pageSize = filters.limit ?? settings.pageSize

  const queryFilters = useMemo(
    () => ({
      page: filters.page,
      limit: pageSize,
      provider,
      year: filters.year,
      quarter: filters.quarter,
      status: filters.status,
      badge,
      aniListId: filters.aniListId,
      sort: filters.sort,
      order: filters.order,
      q: filters.search || undefined
    }),
    [filters, pageSize, provider, badge]
  )

  const { data } = useQuery({
    ...animeListQueryOptions(queryFilters),
    placeholderData: keepPreviousData
  })
  const animeList = data?.data ?? []
  const totalPages = data?.totalPages ?? 0
  const total = data?.total ?? 0

  const { data: baseData } = useQuery(animeListQueryOptions(baseListQuery))
  const grandTotal = baseData?.total ?? total

  const years = useMemo(() => {
    const currentYear = dayjs().year()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  const sortValue: SortValue = `${filters.sort}-${filters.order}` as SortValue
  const onSortChange = (next: string) => {
    const opt = SORT_OPTIONS.find((o) => o.value === next)
    if (!opt) return
    setFilters((prev) => ({ ...prev, sort: opt.sort, order: opt.order, page: 1 }))
  }

  const activeChips: ActiveChip[] = [
    provider != null
      ? {
          key: 'provider',
          label: '配信元',
          value: providerLabel[provider] ? providerLabel[provider] : provider,
          dot: PROVIDER_DOT[provider],
          onClear: () => setFilter('provider')(undefined)
        }
      : null,
    filters.year != null
      ? {
          key: 'year',
          label: '年',
          value: `${filters.year}`,
          onClear: () => setFilter('year')(undefined)
        }
      : null,
    filters.quarter != null
      ? {
          key: 'quarter',
          label: 'クール',
          value: QUARTER_LABEL[filters.quarter] ? QUARTER_LABEL[filters.quarter] : '',
          onClear: () => setFilter('quarter')(undefined)
        }
      : null,
    filters.status != null
      ? {
          key: 'status',
          label: 'ステータス',
          value: STATUS_LABEL[filters.status] ? STATUS_LABEL[filters.status] : filters.status,
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
    filters.aniListId != null
      ? {
          key: 'aniListId',
          label: '関連シリーズ',
          value: `${filters.aniListId}`,
          onClear: () => setFilter('aniListId')(undefined)
        }
      : null,
    filters.search !== ''
      ? {
          key: 'search',
          label: '検索',
          value: filters.search,
          query: true,
          onClear: () => setFilter('search')('')
        }
      : null
  ].filter((v) => v !== null)

  const hasFilters = activeChips.length > 0

  /** 表示件数は絞り込み条件ではなく表示の好みなので、リセットしても持ち越す。 */
  const resetFilters = () => {
    setFilters((prev) => ({ ...browseFiltersDefaults(settings), limit: prev.limit }))
  }

  const panel = (
    <BrowseFilterPanel
      provider={provider}
      year={filters.year}
      quarter={filters.quarter}
      status={filters.status}
      badge={badge}
      years={years}
      hasFilters={hasFilters}
      onChangeProvider={setFilter('provider')}
      onChangeYear={setFilter('year')}
      onChangeQuarter={setFilter('quarter')}
      onChangeStatus={setFilter('status')}
      onChangeBadge={setFilter('badge')}
      onReset={resetFilters}
    />
  )

  const rangeStart = total === 0 ? 0 : (filters.page - 1) * pageSize + 1
  const rangeEnd = Math.min(filters.page * pageSize, total)

  return (
    <>
      <SidebarSlot>
        <div className='min-h-0 overflow-y-auto border-t border-border pt-3.5 max-sm:hidden'>{panel}</div>
      </SidebarSlot>

      <PageContainer className='gap-10 max-sm:gap-[30px]'>
        <div className='flex flex-wrap items-end justify-between gap-5'>
          <div>
            <h1 className='mt-1 text-2xl leading-[1.2] font-bold tracking-[-0.02em] max-sm:text-xl'>アニメ一覧</h1>
            <p className='mt-1 text-xs leading-[18px] text-muted-foreground tabular-nums'>
              {hasFilters ? (
                <>
                  <b className='font-semibold text-foreground'>{grandTotal}</b> 件中{' '}
                  <b className='font-semibold text-foreground'>{total}</b> 件に絞り込み中
                </>
              ) : (
                <>
                  <b className='font-semibold text-foreground'>{total}</b> 件のアニメを管理中
                </>
              )}
            </p>
          </div>
          <div className='flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap'>
            <SearchBar value={filters.search} onChange={setFilter('search')} />
            <div className='relative'>
              <select
                aria-label='並び替え'
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value)}
                className='h-[34px] appearance-none rounded-full border border-input bg-background pr-[26px] pl-3 text-[12.5px] text-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none'
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className='pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted-foreground' />
            </div>
          </div>
        </div>

        <div className='flex min-h-[26px] flex-wrap items-center gap-1.5 text-xs'>
          <button
            type='button'
            onClick={() => setSheetOpen(true)}
            className='inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs text-foreground sm:hidden'
          >
            <SlidersHorizontal className='size-3' aria-hidden='true' />
            絞り込み
            {hasFilters && (
              <span className='rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums'>
                {activeChips.length}
              </span>
            )}
          </button>

          {hasFilters ? (
            <>
              <span className='text-muted-foreground max-sm:hidden'>適用中</span>
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className={`inline-flex h-6 items-center gap-1 rounded-md pr-1 pl-2.5 text-xs ${
                    chip.query ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {chip.dot !== undefined && (
                    <span aria-hidden='true' className={`size-[7px] rounded-full ${chip.dot}`} />
                  )}
                  <span className={chip.query ? 'opacity-65' : 'text-muted-foreground'}>{chip.label}</span>
                  <span className='max-w-40 truncate'>{chip.value}</span>
                  <button
                    type='button'
                    onClick={chip.onClear}
                    aria-label={`${chip.label} ${chip.value} を解除`}
                    className='grid size-[18px] place-items-center rounded-sm text-muted-foreground hover:bg-border hover:text-foreground'
                  >
                    <X className='size-[11px]' />
                  </button>
                </span>
              ))}
              <button
                type='button'
                onClick={resetFilters}
                className='ml-1 rounded-md px-2 py-1 text-xs leading-[18px] text-muted-foreground hover:bg-muted hover:text-foreground'
              >
                すべて解除
              </button>
            </>
          ) : (
            <span className='text-muted-foreground max-sm:hidden'>絞り込みなし</span>
          )}
          <span className='ml-auto inline-flex h-6 items-center text-muted-foreground tabular-nums max-sm:ml-0 max-sm:w-full'>
            {total} 件
          </span>
        </div>

        {animeList.length === 0 ? (
          <div className='py-20 text-center'>
            <p className='text-xs text-muted-foreground'>条件に合うアニメが見つかりません</p>
            {hasFilters && (
              <button
                type='button'
                onClick={resetFilters}
                className='mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              >
                <RotateCcw className='size-[13px]' aria-hidden='true' />
                フィルタをリセット
              </button>
            )}
          </div>
        ) : (
          <div className={`grid ${DENSITY_GRID[settings.density]}`}>
            {animeList.map((anime, index) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                index={index}
                filterYear={filters.year}
                filterStatus={filters.status}
                onFilterYear={setFilter('year')}
                onFilterStatus={setFilter('status')}
                onSelect={setDrawerId}
              />
            ))}
          </div>
        )}

        {total > 0 && (
          <nav aria-label='ページネーション' className='flex flex-wrap items-center gap-4 max-sm:gap-2.5'>
            <div className='text-xs text-muted-foreground tabular-nums'>
              <b className='font-semibold text-foreground'>
                {rangeStart}–{rangeEnd}
              </b>{' '}
              / {total} 件
            </div>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              表示件数
              <fieldset aria-label='表示件数' className='inline-flex gap-0.5 rounded-[7px] bg-muted p-0.5'>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type='button'
                    aria-pressed={pageSize === size}
                    onClick={() => setFilter('limit')(size)}
                    className='inline-flex h-[22px] items-center rounded-[5px] px-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums transition-colors hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_var(--overlay)]'
                  >
                    {size}
                  </button>
                ))}
              </fieldset>
            </div>
            {totalPages > 1 && (
              <div className='ml-auto max-sm:ml-0 max-sm:w-full'>
                <SmartPagination page={filters.page} totalPages={totalPages} onPageChange={setFilter('page')} />
              </div>
            )}
          </nav>
        )}
      </PageContainer>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side='bottom' className='max-h-[76vh] overflow-y-auto rounded-t-[14px] bg-sidebar px-2 pb-[18px]'>
          <SheetHeader className='sticky top-0 z-1 -mx-2 border-b border-border bg-sidebar px-4 pt-3 pb-2.5'>
            <SheetTitle className='text-[13px] font-bold'>絞り込み</SheetTitle>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>

      <AnimeDrawer
        animeId={drawerId}
        open={drawerId !== null}
        onOpenChange={(next) => {
          if (!next) setDrawerId(null)
        }}
      />
    </>
  )
}
