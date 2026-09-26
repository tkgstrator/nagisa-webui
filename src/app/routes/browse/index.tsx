import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { z } from 'zod'
import { AnimeDrawer } from '@/app/components/anime-drawer'
import { SidebarSlot } from '@/app/components/app-sidebar'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { type BrowseFilters, browseFiltersAtom, browseFiltersDefaults } from '@/app/lib/atoms'
import { animeListQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'
import { type CardDensity, useSettings } from '@/app/routes/settings/-lib/settings'
import { ProviderTypeEnum } from '@/schemas/message.dto'
import { ActiveFilters } from './-components/active-filters'
import { AnimeCard } from './-components/anime-card'
import { BrowseFilterPanel } from './-components/browse-filters'
import { BrowsePagination } from './-components/browse-pagination'
import { SearchBar } from './-components/search-bar'
import { baseListQuery, buildActiveChips, SORT_OPTIONS, type SortValue } from './-lib/filters'

/** 表示密度ごとの列数と間隔。`default` は決定稿モックのままの値。 */
const DENSITY_GRID: Record<CardDensity, string> = {
  comfortable: 'grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-sm:gap-x-3 max-sm:gap-y-4',
  default:
    'grid-cols-2 gap-x-4 gap-y-[18px] md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 max-sm:gap-x-2.5 max-sm:gap-y-3.5',
  compact: 'grid-cols-3 gap-x-3 gap-y-3.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 max-sm:gap-x-2 max-sm:gap-y-2.5'
}

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
  const content = useIntlayer('browse')
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

  const activeChips = buildActiveChips({
    provider,
    year: filters.year,
    quarter: filters.quarter,
    status: filters.status,
    badge,
    aniListId: filters.aniListId,
    search: filters.search,
    setFilter
  })

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
            <h1 className='mt-1 text-2xl leading-[1.2] font-bold tracking-[-0.02em] max-sm:text-xl'>{content.title}</h1>
            <p className='mt-1 text-xs leading-[18px] text-muted-foreground tabular-nums'>
              {hasFilters ? (
                <>
                  <b className='font-semibold text-foreground'>{grandTotal}</b>
                  {content.filtered.of} <b className='font-semibold text-foreground'>{total}</b>
                  {content.filtered.matching}
                </>
              ) : (
                <>
                  <b className='font-semibold text-foreground'>{total}</b>
                  {content.filtered.managing}
                </>
              )}
            </p>
          </div>
          <div className='flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap'>
            <SearchBar value={filters.search} onChange={setFilter('search')} />
            <div className='relative'>
              <select
                aria-label={content.sortAriaLabel.value}
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

        <ActiveFilters
          hasFilters={hasFilters}
          activeChips={activeChips}
          onOpenFilterSheet={() => setSheetOpen(true)}
          onResetFilters={resetFilters}
        />

        {animeList.length === 0 ? (
          <div className='py-20 text-center'>
            <p className='text-xs text-muted-foreground'>{content.noResults}</p>
            {hasFilters && (
              <button
                type='button'
                onClick={resetFilters}
                className='mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground'
              >
                <RotateCcw className='size-[13px]' aria-hidden='true' />
                {content.resetFilters}
              </button>
            )}
          </div>
        ) : (
          <div className={cn('grid', DENSITY_GRID[settings.density])}>
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

        <BrowsePagination
          total={total}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          pageSize={pageSize}
          page={filters.page}
          totalPages={totalPages}
          onChangePageSize={setFilter('limit')}
          onPageChange={setFilter('page')}
        />
      </PageContainer>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side='bottom' className='max-h-[76vh] overflow-y-auto rounded-t-[14px] bg-sidebar px-2 pb-[18px]'>
          <SheetHeader className='sticky top-0 z-1 -mx-2 border-b border-border bg-sidebar px-4 pt-3 pb-2.5'>
            <SheetTitle className='text-[13px] font-bold'>{content.filterSheetTitle}</SheetTitle>
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
