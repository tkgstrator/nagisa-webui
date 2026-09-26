import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { PageNotice, PageSection } from '@/app/components/page-section'
import { SegmentedControl } from '@/app/components/segmented-control'
import { StatGrid, StatTile } from '@/app/components/stat-tile'
import { appLocale } from '@/app/lib/locale'
import { syncRunStatsQueryOptions } from '@/app/lib/query-options'
import { useSettings } from '@/app/routes/settings/-lib/settings'
import { CronTable } from './-components/cron-table'
import { EntriesTab } from './-components/entries-tab'
import { RecordingsTab } from './-components/recordings-tab'
import { RunsTab } from './-components/runs-tab'
import { ensureTabData, type Search, SearchSchema, type Tab } from './-lib/search'

export const Route = createFileRoute('/admin/logs/')({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(syncRunStatsQueryOptions()), ensureTabData(queryClient, deps)]),
  pendingComponent: LoadingSpinner,
  component: LogsAdminPage
})

function LogsAdminPage() {
  const content = useIntlayer('admin-logs')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [page, setPage] = useState(1)
  const { settings } = useSettings()
  const { data: stats } = useQuery(syncRunStatsQueryOptions())

  const updateSearch = (patch: Partial<Search>) => {
    setPage(1)
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const tabOptions: { value: Tab; label: string }[] = [
    { value: 'runs', label: content.tabs.runs.value },
    { value: 'entries', label: content.tabs.entries.value },
    { value: 'recordings', label: content.tabs.recordings.value }
  ]
  const tabProps = { search, updateSearch, page, setPage, limit: settings.pageSize }

  return (
    <PageContainer className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.page.eyebrow.value} current={content.page.title.value} />}
        title={content.page.title.value}
        sub={content.page.description.value}
      />

      <div>
        {stats === undefined ? (
          <PageNotice tone='err'>{content.stats.unavailable}</PageNotice>
        ) : (
          <StatGrid label={content.stats.ariaLabel.value}>
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
              tone='success'
            />
            <StatTile
              label={content.stats.partial.label.value}
              value={stats.recent.partial}
              unit={content.stats.unit.value}
              note={content.stats.partial.note.value}
              tone='warning'
            />
            <StatTile
              label={content.stats.failed.label.value}
              value={stats.recent.failed}
              unit={content.stats.unit.value}
              note={content.stats.failed.note({ count: stats.recent.running.toLocaleString(appLocale) }).value}
              tone='destructive'
            />
          </StatGrid>
        )}

        <div className='mt-9 max-sm:mt-7'>
          <SegmentedControl
            value={search.tab}
            options={tabOptions}
            onValueChange={(tab) => updateSearch({ tab })}
            label={content.tabs.ariaLabel.value}
          />
        </div>

        {search.tab === 'runs' && stats !== undefined && (
          <div className='mt-9 max-sm:mt-7'>
            <PageSection title={content.runsTab.cronHeading.value} aria-label={content.runsTab.cronAriaLabel.value}>
              <CronTable crons={stats.crons} />
            </PageSection>
          </div>
        )}

        <div className='mt-9 max-sm:mt-7'>
          {search.tab === 'runs' && <RunsTab {...tabProps} />}
          {search.tab === 'entries' && <EntriesTab {...tabProps} />}
          {search.tab === 'recordings' && <RecordingsTab {...tabProps} />}
        </div>
      </div>
    </PageContainer>
  )
}
