import { keepPreviousData, type QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getIntlayer } from 'intlayer'
import { Search as SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { z } from 'zod'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { SmartPagination } from '@/app/components/smart-pagination'
import { StatTile } from '@/app/components/stat-tile'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import {
  logEntriesQueryOptions,
  logStatsQueryOptions,
  recordingEventsQueryOptions,
  syncRunsQueryOptions
} from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { readSettings, useSettings } from '@/app/routes/settings/-lib/settings'
import {
  LogLevelEnum,
  RecordingEventKindEnum,
  RecordingEventStatusEnum,
  RunKindEnum,
  RunStatusEnum
} from '@/schemas/log.dto'
import { CronTable } from './-components/cron-table'
import { EntriesTable } from './-components/entries-table'
import { RecordingsTable } from './-components/recordings-table'
import { RunsTable } from './-components/runs-table'
import { logLevelLabel, recordingKindLabel, recordingStatusLabel, runKindLabel, runStatusLabel } from './-lib/format'

const moduleContent = getIntlayer('admin-logs')

const TabEnum = z.enum(['runs', 'entries', 'recordings'])

const SearchSchema = z.object({
  tab: TabEnum.default('runs'),
  kind: RunKindEnum.optional(),
  status: RunStatusEnum.optional(),
  // 期間は 3 タブで共有する。保持期間が一番長い録画 (180 日) に合わせて上限を取り、
  // 実行履歴と生ログには投げる直前に各テーブルの保持期間で頭打ちを掛ける。
  hours: z.coerce.number().int().min(1).max(4320).default(24),
  level: LogLevelEnum.default('info'),
  // 録画の絞り込みは実行履歴の kind / status と意味が違うので別のキーで持つ。
  recKind: RecordingEventKindEnum.optional(),
  recStatus: RecordingEventStatusEnum.optional(),
  q: z.string().nonempty().optional()
})

type Search = z.infer<typeof SearchSchema>

const KIND_OPTIONS: { value: Search['kind']; label: string }[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'cron', label: runKindLabel.cron },
  { value: 'queue', label: runKindLabel.queue },
  { value: 'manual', label: runKindLabel.manual }
]

const STATUS_OPTIONS: { value: Search['status']; label: string }[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'failed', label: runStatusLabel.failed },
  { value: 'partial', label: runStatusLabel.partial },
  { value: 'success', label: runStatusLabel.success },
  { value: 'running', label: runStatusLabel.running }
]

/** 指定した重大度「以上」が返る。debug は D1 に入らないので出さない。 */
const LEVEL_OPTIONS: { value: Search['level']; label: string }[] = [
  { value: 'info', label: moduleContent.options.level.infoAndAbove({ label: logLevelLabel.info }) },
  { value: 'warning', label: moduleContent.options.level.andAbove({ label: logLevelLabel.warning }) },
  { value: 'error', label: moduleContent.options.level.onlyLabel({ label: logLevelLabel.error }) },
  { value: 'fatal', label: moduleContent.options.level.onlyLabel({ label: logLevelLabel.fatal }) }
]

const REC_KIND_OPTIONS: { value: Search['recKind']; label: string }[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'request', label: recordingKindLabel.request },
  { value: 'status', label: recordingKindLabel.status },
  { value: 'recorded', label: recordingKindLabel.recorded },
  { value: 'not-found', label: recordingKindLabel['not-found'] }
]

const REC_STATUS_OPTIONS: { value: Search['recStatus']; label: string }[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'error', label: recordingStatusLabel.error },
  { value: 'ok', label: recordingStatusLabel.ok }
]

const RUN_HOURS_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: moduleContent.options.hours.h24 },
  { value: 72, label: moduleContent.options.hours.h72 },
  { value: 168, label: moduleContent.options.hours.h168 },
  { value: 720, label: moduleContent.options.hours.h720 },
  { value: 2160, label: moduleContent.options.hours.h2160 }
]

const ENTRY_HOURS_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: moduleContent.options.hours.h24 },
  { value: 72, label: moduleContent.options.hours.h72 },
  { value: 168, label: moduleContent.options.hours.h168 },
  { value: 336, label: moduleContent.options.hours.h336 }
]

const RECORDING_HOURS_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: moduleContent.options.hours.h24 },
  { value: 168, label: moduleContent.options.hours.h168 },
  { value: 720, label: moduleContent.options.hours.h720 },
  { value: 2160, label: moduleContent.options.hours.h2160 },
  { value: 4320, label: moduleContent.options.hours.h4320 }
]

/** log_entries は 14 日しか持たないので、実行履歴側の広い期間をそのまま投げない。 */
const ENTRY_MAX_HOURS = 336

/** sync_runs の保持期間は 90 日。録画タブから戻ってきた 180 日をそのまま投げない。 */
const RUN_MAX_HOURS = 2160

/** 開いているタブのぶんだけ先に取る。3 本とも取ると表示しない 2 本まで待つことになる。 */
const ensureTabData = (queryClient: QueryClient, deps: Search) => {
  const limit = readSettings().pageSize
  if (deps.tab === 'entries')
    return queryClient.ensureInfiniteQueryData(
      logEntriesQueryOptions({ limit, level: deps.level, hours: Math.min(deps.hours, ENTRY_MAX_HOURS), q: deps.q })
    )
  if (deps.tab === 'recordings')
    return queryClient.ensureQueryData(
      recordingEventsQueryOptions({
        page: 1,
        limit,
        kind: deps.recKind,
        status: deps.recStatus,
        hours: deps.hours
      })
    )
  return queryClient.ensureQueryData(
    syncRunsQueryOptions({
      page: 1,
      limit,
      kind: deps.kind,
      status: deps.status,
      hours: Math.min(deps.hours, RUN_MAX_HOURS)
    })
  )
}

export const Route = createFileRoute('/admin/logs/')({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(logStatsQueryOptions()), ensureTabData(queryClient, deps)]),
  pendingComponent: LoadingSpinner,
  component: LogsAdminPage
})

const tabListClass =
  'h-[38px] w-max min-w-full gap-0.5 rounded-none bg-transparent p-0 shadow-[inset_0_-1px_0_var(--border)] group-data-horizontal/tabs:h-[38px]'
const tabTriggerClass =
  'group/tab h-[38px] flex-none gap-[7px] rounded-none border-b-2 border-transparent px-3 text-sm font-normal text-muted-foreground after:hidden hover:bg-muted/65 hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:font-semibold data-active:text-foreground data-active:hover:bg-transparent dark:data-active:border-transparent dark:data-active:border-b-primary dark:data-active:bg-transparent'

/** summary の部分一致。入力ごとに URL を書き換えると履歴が荒れるので 300ms 待つ。 */
function SummarySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const content = useIntlayer('admin-logs')
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (v: string) => {
    setLocalValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange(v), 300)
  }

  return (
    <div className='relative w-full sm:w-60'>
      <SearchIcon className='pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground' />
      <Input
        type='search'
        placeholder={content.search.placeholder.value}
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className='h-[34px] rounded-full bg-background pr-3 pl-8 text-[12.5px] focus-visible:border-primary md:text-[12.5px]'
        aria-label={content.search.ariaLabel.value}
      />
    </div>
  )
}

function LogsAdminPage() {
  const content = useIntlayer('admin-logs')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [page, setPage] = useState(1)
  const { settings } = useSettings()

  const runHours = Math.min(search.hours, RUN_MAX_HOURS)
  const { data: stats } = useQuery(logStatsQueryOptions())
  const { data } = useQuery({
    ...syncRunsQueryOptions({
      page,
      limit: settings.pageSize,
      kind: search.kind,
      status: search.status,
      hours: runHours
    }),
    placeholderData: keepPreviousData
  })

  const { data: recordingData } = useQuery({
    ...recordingEventsQueryOptions({
      page,
      limit: settings.pageSize,
      kind: search.recKind,
      status: search.recStatus,
      hours: search.hours
    }),
    placeholderData: keepPreviousData
  })

  const entryHours = Math.min(search.hours, ENTRY_MAX_HOURS)
  const {
    data: entryPages,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  } = useInfiniteQuery({
    ...logEntriesQueryOptions({
      limit: settings.pageSize,
      level: search.level,
      hours: entryHours,
      q: search.q
    }),
    placeholderData: keepPreviousData
  })

  const runs = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const entries = entryPages?.pages.flatMap((p) => p.data) ?? []
  const recordings = recordingData?.data ?? []
  const recordingTotal = recordingData?.total ?? 0
  const recordingTotalPages = recordingData?.totalPages ?? 0

  const updateSearch = (patch: Partial<Search>) => {
    setPage(1)
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const hoursOptions =
    search.tab === 'entries'
      ? ENTRY_HOURS_OPTIONS
      : search.tab === 'recordings'
        ? RECORDING_HOURS_OPTIONS
        : RUN_HOURS_OPTIONS

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>{content.page.title}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{content.page.description}</p>
      </header>

      {stats === undefined ? (
        <p className='border-l-[3px] border-border px-3.5 py-3 text-sm text-muted-foreground'>
          {content.stats.unavailable}
        </p>
      ) : (
        <section aria-label={content.stats.ariaLabel.value} className='grid grid-cols-4 gap-6 max-lg:grid-cols-2'>
          <StatTile
            label={content.stats.total.label.value}
            value={stats.recent.total}
            unit={content.stats.unit.value}
            note={content.stats.total.note.value}
            tone='primary'
          />
          <StatTile
            label={content.stats.success.label.value}
            value={stats.recent.success}
            unit={content.stats.unit.value}
            note={content.stats.success.note.value}
            tone='ok'
          />
          <StatTile
            label={content.stats.partial.label.value}
            value={stats.recent.partial}
            unit={content.stats.unit.value}
            note={content.stats.partial.note.value}
            tone='warn'
          />
          <StatTile
            label={content.stats.failed.label.value}
            value={stats.recent.failed}
            unit={content.stats.unit.value}
            note={content.stats.failed.note({ count: stats.recent.running.toLocaleString('ja-JP') }).value}
            tone='err'
          />
        </section>
      )}

      <Tabs
        value={search.tab}
        onValueChange={(value) => updateSearch({ tab: TabEnum.parse(value) })}
        className='min-w-0 gap-0'
      >
        <div className='-mx-1 overflow-x-auto px-1'>
          <TabsList variant='line' className={tabListClass}>
            <TabsTrigger value='runs' className={tabTriggerClass}>
              {content.tabs.runs}
            </TabsTrigger>
            <TabsTrigger value='entries' className={tabTriggerClass}>
              {content.tabs.entries}
            </TabsTrigger>
            <TabsTrigger value='recordings' className={tabTriggerClass}>
              {content.tabs.recordings}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='runs' className='flex min-w-0 flex-col gap-6 pt-4'>
          {stats !== undefined && (
            <section aria-label={content.runsTab.cronAriaLabel.value} className='flex flex-col gap-2'>
              <h2 className='text-sm font-semibold'>{content.runsTab.cronHeading}</h2>
              <CronTable crons={stats.crons} />
            </section>
          )}

          <section aria-label={content.runsTab.sectionAriaLabel.value} className='flex flex-col gap-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='mr-auto text-sm font-semibold'>
                {content.runsTab.heading({ count: total.toLocaleString('ja-JP') })}
              </h2>
              <FilterPopover
                label={content.filters.period.value}
                value={runHours}
                options={hoursOptions}
                onSelect={(v) => updateSearch({ hours: v })}
              />
              <FilterPopover
                label={content.filters.kind.value}
                value={search.kind}
                options={KIND_OPTIONS}
                onSelect={(v) => updateSearch({ kind: v })}
              />
              <FilterPopover
                label={content.filters.status.value}
                value={search.status}
                options={STATUS_OPTIONS}
                onSelect={(v) => updateSearch({ status: v })}
              />
            </div>

            {runs.length === 0 ? (
              <div className='py-20 text-center text-sm text-muted-foreground'>{content.runsTab.empty}</div>
            ) : (
              <RunsTable runs={runs} />
            )}

            {totalPages > 1 && <SmartPagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </section>
        </TabsContent>

        <TabsContent value='entries' className='flex min-w-0 flex-col gap-3 pt-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='mr-auto text-sm font-semibold'>{content.entriesTab.heading}</h2>
            <SummarySearch value={search.q ?? ''} onChange={(v) => updateSearch({ q: v || undefined })} />
            <FilterPopover
              label={content.filters.period.value}
              value={entryHours}
              options={hoursOptions}
              onSelect={(v) => updateSearch({ hours: v })}
            />
            <FilterPopover
              label={content.filters.level.value}
              value={search.level}
              options={LEVEL_OPTIONS}
              onSelect={(v) => updateSearch({ level: v })}
            />
          </div>

          {entries.length === 0 ? (
            <div className='py-20 text-center text-sm text-muted-foreground'>{content.entriesTab.empty}</div>
          ) : (
            <EntriesTable entries={entries} />
          )}

          <div className='flex justify-center'>
            <Button
              variant='outline'
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
              className='w-48'
            >
              {isFetchingNextPage
                ? content.entriesTab.loading
                : hasNextPage
                  ? content.entriesTab.loadMore
                  : content.entriesTab.noMore}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='recordings' className='flex min-w-0 flex-col gap-3 pt-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='mr-auto text-sm font-semibold'>
              {content.recordingsTab.heading({ count: recordingTotal.toLocaleString('ja-JP') })}
            </h2>
            <FilterPopover
              label={content.filters.period.value}
              value={search.hours}
              options={hoursOptions}
              onSelect={(v) => updateSearch({ hours: v })}
            />
            <FilterPopover
              label={content.filters.kind.value}
              value={search.recKind}
              options={REC_KIND_OPTIONS}
              onSelect={(v) => updateSearch({ recKind: v })}
            />
            <FilterPopover
              label={content.filters.result.value}
              value={search.recStatus}
              options={REC_STATUS_OPTIONS}
              onSelect={(v) => updateSearch({ recStatus: v })}
            />
          </div>

          {recordings.length === 0 ? (
            <div className='py-20 text-center text-sm text-muted-foreground'>{content.recordingsTab.empty}</div>
          ) : (
            <RecordingsTable events={recordings} />
          )}

          {recordingTotalPages > 1 && (
            <SmartPagination page={page} totalPages={recordingTotalPages} onPageChange={setPage} />
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
