import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { useCallback, useMemo } from 'react'
import { useIntlayer } from 'react-intlayer'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { SmartPagination } from '@/app/components/smart-pagination'
import { type RecordingsFilters, recordingsFiltersAtom } from '@/app/lib/atoms'
import { animeListQueryOptions } from '@/app/lib/query-options'
import { readSettings, useSettings } from '@/app/routes/settings/-lib/settings'
import { RecordingsEmpty } from './-components/recordings-empty'
import { RecordingsHeader } from './-components/recordings-header'
import { RecordingsSidebar } from './-components/recordings-sidebar'
import { RecordingsTable } from './-components/recordings-table'
import { RecordingsToolbar } from './-components/recordings-toolbar'
import { SummaryStats } from './-components/summary-stats'
import { ViewToggle } from './-components/view-toggle'
import { WeeklySchedule } from './-components/weekly-schedule'
import { activeFilterTerms, summarize } from './-lib/summary'

export const Route = createFileRoute('/recordings/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(
      animeListQueryOptions({ scheduled: true, excludeStatus: 'FINISHED', page: 1, limit: readSettings().pageSize })
    ),
  pendingComponent: LoadingSpinner,
  component: RecordingsPage
})

function RecordingsPage() {
  const content = useIntlayer('recordings')
  const [filters, setFilters] = useAtom(recordingsFiltersAtom)
  const { search, recorded: recordedFilter, expiringOnly, provider, sort, view, page } = filters
  const showFinished = filters.showFinished ?? false

  /** 絞り込みを変えたら 1 ページ目へ戻す。ページ送りと表示モードの切替はページを保つ。 */
  const setFilter = useCallback(
    <K extends keyof RecordingsFilters>(key: K) =>
      (value: RecordingsFilters[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value, ...(key === 'page' || key === 'view' ? {} : { page: 1 }) }))
      },
    [setFilters]
  )
  const setPage = setFilter('page')
  const setSearch = setFilter('search')
  const setRecordedFilter = setFilter('recorded')
  const setExpiringOnly = setFilter('expiringOnly')
  const setShowFinished = setFilter('showFinished')
  const setProvider = setFilter('provider')
  const setSort = setFilter('sort')
  const setView = setFilter('view')

  const { settings } = useSettings()
  const pageSize = settings.pageSize

  const queryFilters = useMemo(() => {
    const recorded = recordedFilter === 'recorded' ? true : recordedFilter === 'pending' ? false : undefined
    const [sortKey, order] = sort.split('-') as ['title' | 'year' | 'updatedAt', 'asc' | 'desc']
    return {
      scheduled: true,
      page,
      limit: pageSize,
      q: search.trim() || undefined,
      recorded,
      provider,
      sort: sortKey,
      order,
      badge: expiringOnly ? 'EXPIRING' : undefined
    }
  }, [page, pageSize, search, recordedFilter, expiringOnly, provider, sort])

  const { data } = useQuery({
    ...animeListQueryOptions({ ...queryFilters, excludeStatus: showFinished ? undefined : 'FINISHED' }),
    placeholderData: keepPreviousData
  })
  const anime = data?.data ?? []
  const totalPages = data?.totalPages ?? 0
  const total = data?.total ?? 0

  /** 一覧から外した完結作品の数。件数だけ要るので limit=1 で total を引く。 */
  const { data: finishedData } = useQuery({
    ...animeListQueryOptions({ ...queryFilters, status: 'FINISHED', page: 1, limit: 1 }),
    enabled: !showFinished
  })
  const hiddenFinished = showFinished ? 0 : (finishedData?.total ?? 0)

  /** 並び順と表示モードは残したまま、絞り込みだけを既定へ戻す。 */
  const resetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: '',
      recorded: 'all',
      expiringOnly: false,
      showFinished: false,
      provider: undefined,
      page: 1
    }))
  }

  const hasActiveFilters =
    search.trim().length > 0 || recordedFilter !== 'all' || expiringOnly || showFinished || provider !== undefined

  const stats = useMemo(() => summarize(anime, settings.expiringLeadDays), [anime, settings.expiringLeadDays])

  const activeTerms = useMemo(
    () => activeFilterTerms({ search, provider, recordedFilter, expiringOnly }),
    [search, provider, recordedFilter, expiringOnly]
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = (page - 1) * pageSize + anime.length

  return (
    <PageContainer className='gap-10 text-sm max-sm:gap-[30px]'>
      <RecordingsSidebar
        total={total}
        recorded={stats.recorded}
        pending={stats.pending}
        onFilterChange={setRecordedFilter}
      />

      <RecordingsHeader
        total={total + hiddenFinished}
        hiddenFinished={hiddenFinished}
        search={search}
        onSearchChange={setSearch}
      />

      <ViewToggle view={view} onViewChange={setView} />

      {view === 'schedule' ? (
        <WeeklySchedule items={anime} />
      ) : (
        <div>
          <div className='mb-[38px]'>
            <SummaryStats
              total={total}
              recorded={stats.recorded}
              pending={stats.pending}
              expiring={stats.expiring}
              expiringSoonestDays={stats.expiringSoonestDays}
              visible={anime.length}
            />
          </div>

          <RecordingsToolbar
            recordedFilter={recordedFilter}
            onRecordedFilterChange={setRecordedFilter}
            provider={provider}
            onProviderChange={setProvider}
            expiringOnly={expiringOnly}
            onExpiringOnlyChange={setExpiringOnly}
            showFinished={showFinished}
            onShowFinishedChange={setShowFinished}
            sort={sort}
            onSortChange={setSort}
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
          />

          {anime.length === 0 ? (
            <div className='mt-6'>
              <RecordingsEmpty filtered={hasActiveFilters} terms={activeTerms} onReset={resetFilters} />
            </div>
          ) : (
            <>
              <RecordingsTable items={anime} sort={sort} onSortChange={setSort} />

              <div className='mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 text-xs text-muted-foreground'>
                <ul className='inline-flex flex-wrap gap-x-3.5 gap-y-1' aria-label={content.legend.ariaLabel.value}>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-success' />
                    {content.legend.recorded}
                  </li>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-warning' />
                    {content.legend.expiring}
                  </li>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-border' />
                    {content.legend.pending}
                  </li>
                </ul>
                <div className='flex items-center gap-2'>
                  <span className='tabular-nums'>
                    {content.rangeText({ start: rangeStart, end: rangeEnd, total }).value}
                  </span>
                  <SmartPagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </PageContainer>
  )
}
