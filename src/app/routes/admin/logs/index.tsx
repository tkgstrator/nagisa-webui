import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { SmartPagination } from '@/app/components/smart-pagination'
import { StatTile } from '@/app/components/stat-tile'
import { logStatsQueryOptions, syncRunsQueryOptions } from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { readSettings, useSettings } from '@/app/routes/settings/-lib/settings'
import { RunKindEnum, RunStatusEnum } from '@/schemas/log.dto'
import { CronTable } from './-components/cron-table'
import { RunsTable } from './-components/runs-table'
import { runKindLabel, runStatusLabel } from './-lib/format'

const SearchSchema = z.object({
  kind: RunKindEnum.optional(),
  status: RunStatusEnum.optional(),
  hours: z.coerce.number().int().min(1).max(2160).default(24)
})

type Search = z.infer<typeof SearchSchema>

const KIND_OPTIONS: { value: Search['kind']; label: string }[] = [
  { value: undefined, label: 'すべて' },
  { value: 'cron', label: runKindLabel.cron },
  { value: 'queue', label: runKindLabel.queue },
  { value: 'manual', label: runKindLabel.manual }
]

const STATUS_OPTIONS: { value: Search['status']; label: string }[] = [
  { value: undefined, label: 'すべて' },
  { value: 'failed', label: runStatusLabel.failed },
  { value: 'partial', label: runStatusLabel.partial },
  { value: 'success', label: runStatusLabel.success },
  { value: 'running', label: runStatusLabel.running }
]

const HOURS_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: '直近 24 時間' },
  { value: 72, label: '直近 3 日' },
  { value: 168, label: '直近 7 日' },
  { value: 720, label: '直近 30 日' },
  { value: 2160, label: '直近 90 日' }
]

export const Route = createFileRoute('/admin/logs/')({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(logStatsQueryOptions()),
      queryClient.ensureQueryData(
        syncRunsQueryOptions({
          page: 1,
          limit: readSettings().pageSize,
          kind: deps.kind,
          status: deps.status,
          hours: deps.hours
        })
      )
    ]),
  pendingComponent: LoadingSpinner,
  component: LogsAdminPage
})

function LogsAdminPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [page, setPage] = useState(1)
  const { settings } = useSettings()

  const { data: stats } = useQuery(logStatsQueryOptions())
  const { data } = useQuery({
    ...syncRunsQueryOptions({
      page,
      limit: settings.pageSize,
      kind: search.kind,
      status: search.status,
      hours: search.hours
    }),
    placeholderData: keepPreviousData
  })

  const runs = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const updateSearch = (patch: Partial<Search>) => {
    setPage(1)
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>同期ログ</h1>
        <p className='mt-1 text-sm text-muted-foreground'>cron / Queue バッチ / 手動実行の履歴と、cron の稼働状況</p>
      </header>

      {stats === undefined ? (
        <p className='border-l-[3px] border-border px-3.5 py-3 text-sm text-muted-foreground'>
          集計を取得できませんでした
        </p>
      ) : (
        <section aria-label='直近 24 時間の実行' className='grid grid-cols-4 gap-6 max-lg:grid-cols-2'>
          <StatTile label='実行' value={stats.recent.total} unit='件' note='直近 24 時間' tone='primary' />
          <StatTile label='成功' value={stats.recent.success} unit='件' note='全件処理できた実行' tone='ok' />
          <StatTile
            label='一部失敗'
            value={stats.recent.partial}
            unit='件'
            note='一部のジョブが落ちた実行'
            tone='warn'
          />
          <StatTile
            label='失敗'
            value={stats.recent.failed}
            unit='件'
            note={`実行中 ${stats.recent.running.toLocaleString('ja-JP')} 件`}
            tone='err'
          />
        </section>
      )}

      {stats !== undefined && (
        <section aria-label='cron の稼働状況' className='flex flex-col gap-2'>
          <h2 className='text-sm font-semibold'>cron の稼働状況</h2>
          <CronTable crons={stats.crons} />
        </section>
      )}

      <section aria-label='実行履歴' className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h2 className='mr-auto text-sm font-semibold'>実行履歴 ({total.toLocaleString('ja-JP')} 件)</h2>
          <FilterPopover
            label='期間'
            value={search.hours}
            options={HOURS_OPTIONS}
            onSelect={(v) => updateSearch({ hours: v })}
          />
          <FilterPopover
            label='種別'
            value={search.kind}
            options={KIND_OPTIONS}
            onSelect={(v) => updateSearch({ kind: v })}
          />
          <FilterPopover
            label='状態'
            value={search.status}
            options={STATUS_OPTIONS}
            onSelect={(v) => updateSearch({ status: v })}
          />
        </div>

        {runs.length === 0 ? (
          <div className='py-20 text-center text-sm text-muted-foreground'>該当する実行はありません</div>
        ) : (
          <RunsTable runs={runs} />
        )}

        {totalPages > 1 && <SmartPagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </section>
    </PageContainer>
  )
}
