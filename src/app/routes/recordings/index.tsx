import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { SmartPagination } from '@/app/components/smart-pagination'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/dialog'
import api from '@/app/lib/api'
import { type RecordingsFilters, recordingsFiltersAtom } from '@/app/lib/atoms'
import { providerLabel } from '@/app/lib/constants'
import { queryKeys } from '@/app/lib/query-keys'
import { animeListQueryOptions } from '@/app/lib/query-options'
import { readSettings, useSettings } from '@/app/routes/settings/-lib/settings'
import { daysUntil } from './-components/format'
import { RecordingsEmpty } from './-components/recordings-empty'
import { RecordingsSidebar } from './-components/recordings-sidebar'
import { RecordingsTable } from './-components/recordings-table'
import { RECORDED_OPTIONS, RecordingsToolbar } from './-components/recordings-toolbar'
import { SummaryStats } from './-components/summary-stats'
import { WeeklySchedule } from './-components/weekly-schedule'

export const Route = createFileRoute('/recordings/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(animeListQueryOptions({ scheduled: true, page: 1, limit: readSettings().pageSize })),
  pendingComponent: LoadingSpinner,
  component: RecordingsPage
})

function RecordingsPage() {
  const [filters, setFilters] = useAtom(recordingsFiltersAtom)
  const { search, recorded: recordedFilter, expiringOnly, provider, sort, view, page } = filters

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
  const setProvider = setFilter('provider')
  const setSort = setFilter('sort')
  const setView = setFilter('view')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()
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
    ...animeListQueryOptions(queryFilters),
    placeholderData: keepPreviousData
  })
  const anime = data?.data ?? []
  const totalPages = data?.totalPages ?? 0
  const total = data?.total ?? 0

  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => api.updateAnime({ scheduled: false }, { params: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
    }
  })

  const onUnschedule = async (id: string) => {
    try {
      await unscheduleMutation.mutateAsync(id)
      toast.success('予約を解除しました')
    } catch {
      toast.error('予約解除に失敗しました')
    }
  }

  const bulkUnscheduleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => api.updateAnime({ scheduled: false }, { params: { id } }))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      const succeeded = results.length - failed
      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
      setSelected(new Set())
      if (failed === 0) toast.success(`${succeeded} 件の予約を解除しました`)
      else toast.warning(`${succeeded} 件解除、${failed} 件失敗`)
    },
    onError: () => toast.error('一括解除に失敗しました')
  })

  const runBulkUnschedule = () => {
    setConfirmOpen(false)
    bulkUnscheduleMutation.mutate(Array.from(selected))
  }

  /** 確認を挟むかは設定次第。挟まない設定ならその場で解除する。 */
  const requestBulkUnschedule = () => {
    if (settings.confirmBulkCancel) setConfirmOpen(true)
    else runBulkUnschedule()
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const allSelected = anime.length > 0 && anime.every((item) => prev.has(item.id))
      if (allSelected) {
        const next = new Set(prev)
        for (const item of anime) next.delete(item.id)
        return next
      }
      const next = new Set(prev)
      for (const item of anime) next.add(item.id)
      return next
    })
  }

  const allVisibleSelected = anime.length > 0 && anime.every((item) => selected.has(item.id))
  const selectedCount = selected.size

  /** 並び順と表示モードは残したまま、絞り込みだけを既定へ戻す。 */
  const resetFilters = () => {
    setFilters((prev) => ({ ...prev, search: '', recorded: 'all', expiringOnly: false, provider: undefined, page: 1 }))
  }

  const hasActiveFilters =
    search.trim().length > 0 || recordedFilter !== 'all' || expiringOnly || provider !== undefined

  /** 表示中のページから算出するサマリ。総数以外はサーバー側で集計できないため。 */
  const stats = useMemo(() => {
    const recorded = anime.filter((item) => item.recorded).length
    /** 「配信終了予定」に数えるのは、設定した日数以内に終わるものだけ。 */
    const expiringDays = anime
      .filter((item) => item.expiredAt !== null)
      .map((item) => daysUntil(item.expiredAt as string))
      .filter((days) => days <= settings.expiringLeadDays)
    return {
      recorded,
      pending: anime.length - recorded,
      expiring: expiringDays.length,
      expiringSoonestDays: expiringDays.length === 0 ? null : Math.min(...expiringDays)
    }
  }, [anime, settings.expiringLeadDays])

  /** 空表示に並べる、適用中の条件ラベル。 */
  const activeTerms = useMemo(() => {
    const terms: string[] = []
    if (search.trim().length > 0) terms.push(`検索: ${search.trim()}`)
    if (provider !== undefined) terms.push(providerLabel[provider] ?? provider)
    if (recordedFilter !== 'all') {
      terms.push(RECORDED_OPTIONS.find((opt) => opt.value === recordedFilter)?.label ?? recordedFilter)
    }
    if (expiringOnly) terms.push('配信終了予定のみ')
    return terms
  }, [search, provider, recordedFilter, expiringOnly])

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

      <header className='flex flex-wrap items-end justify-between gap-5'>
        <div>
          <h1 className='text-[28px] leading-tight font-bold tracking-[-0.02em]'>録画一覧</h1>
          <p className='mt-1 text-xs text-muted-foreground'>
            <span className='tabular-nums'>{total}</span> 作品を予約中
          </p>
        </div>
        <label className='relative max-w-[360px] flex-[1_1_260px] max-sm:max-w-none max-sm:flex-[1_1_100%]'>
          <span className='sr-only'>タイトル検索</span>
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            className='pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground'
            aria-hidden='true'
          >
            <circle cx='11' cy='11' r='7' />
            <path d='m20 20-3.5-3.5' />
          </svg>
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='タイトルで絞り込み'
            className='h-[34px] w-full rounded-lg border border-input bg-background pr-[30px] pl-8 text-[13px] text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-ring'
          />
        </label>
      </header>

      <fieldset className='mt-[18px] border-0 p-0' aria-label='表示切替'>
        <div className='inline-flex rounded-lg border border-border bg-background p-0.5'>
          {(
            [
              { value: 'list', label: '一覧' },
              { value: 'schedule', label: '週間スケジュール' }
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type='button'
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring ${
                view === value
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

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
              <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-2 text-xs text-muted-foreground'>
                <label className='inline-flex cursor-pointer items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label='表示中をすべて選択'
                    className='size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
                  />
                  表示中をすべて選択
                </label>
                <span className='tabular-nums'>
                  <b className='font-bold text-foreground'>{selectedCount}</b> 件選択中
                </span>
                <div className='ml-auto inline-flex flex-wrap items-center gap-2 max-sm:ml-0 max-sm:w-full'>
                  <button
                    type='button'
                    disabled={selectedCount === 0 || bulkUnscheduleMutation.isPending}
                    onClick={requestBulkUnschedule}
                    className='inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs whitespace-nowrap text-destructive transition-colors hover:bg-status-cancelled focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-45 disabled:hover:bg-background'
                  >
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2.2'
                      strokeLinecap='round'
                      className='size-[13px]'
                      aria-hidden='true'
                    >
                      <path d='M6 6l12 12M18 6 6 18' />
                    </svg>
                    選択分を解除
                  </button>
                </div>
              </div>

              <RecordingsTable
                items={anime}
                selected={selected}
                onToggleSelected={toggleSelected}
                onUnschedule={(item) => onUnschedule(item.id)}
                unschedulingId={unscheduleMutation.isPending ? (unscheduleMutation.variables ?? null) : null}
                sort={sort}
                onSortChange={setSort}
              />

              <div className='mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 text-xs text-muted-foreground'>
                <ul className='inline-flex flex-wrap gap-x-3.5 gap-y-1' aria-label='行頭の色の凡例'>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-success' />
                    録画済み
                  </li>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-warning' />
                    配信終了予定
                  </li>
                  <li className='inline-flex items-center gap-1.5'>
                    <i className='h-2 w-3 rounded-sm bg-border' />
                    未録画
                  </li>
                </ul>
                <div className='flex items-center gap-2'>
                  <span className='tabular-nums'>
                    {rangeStart}–{rangeEnd} / {total} 件
                  </span>
                  <SmartPagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>選択した予約を解除しますか</DialogTitle>
            <DialogDescription>
              <span className='tabular-nums'>{selectedCount}</span>{' '}
              件の予約を解除します。録画済みのファイルは削除されません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <button
                  type='button'
                  className='inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs transition-colors hover:bg-muted'
                >
                  やめる
                </button>
              }
            />
            <button
              type='button'
              onClick={runBulkUnschedule}
              className='inline-flex h-8 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90'
            >
              解除する
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
