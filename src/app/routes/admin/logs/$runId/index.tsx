import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { StatTile } from '@/app/components/stat-tile'
import { syncRunQueryOptions } from '@/app/lib/query-options'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { SyncRunSchema } from '@/schemas/log.dto'
import { EntriesTable } from '../-components/entries-table'
import { RunStatusBadge, RunsTable } from '../-components/runs-table'
import { formatDuration, runKindLabel, runStatusAccent, triggerLabel } from '../-lib/format'

export const Route = createFileRoute('/admin/logs/$runId/')({
  loader: ({ context: { queryClient }, params }) => queryClient.ensureQueryData(syncRunQueryOptions(params.runId)),
  pendingComponent: LoadingSpinner,
  component: SyncRunDetailPage
})

/** meta は JSON 文字列。壊れていても画面は落とさず生のまま出す。 */
const formatMeta = (meta: string | null): string | null => {
  if (meta === null) return null
  try {
    return JSON.stringify(JSON.parse(meta), null, 2)
  } catch {
    return meta
  }
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className='flex flex-col gap-0.5 border-b border-border py-2 sm:flex-row sm:items-baseline sm:gap-4'>
    <span className='text-xs font-semibold text-muted-foreground sm:w-28 sm:shrink-0'>{label}</span>
    <span className='min-w-0 text-[13px]'>{children}</span>
  </div>
)

function SyncRunDetailPage() {
  const content = useIntlayer('admin-logs-run-id')
  const { runId } = Route.useParams()
  const { data } = useQuery(syncRunQueryOptions(runId))

  if (data === undefined) {
    return (
      <PageContainer className='gap-6'>
        <p className='border-l-[3px] border-destructive px-3.5 py-3 text-sm text-muted-foreground'>
          {content.fetchError}
        </p>
      </PageContainer>
    )
  }

  const run: SyncRunSchema = data.run
  const meta = formatMeta(run.meta)

  return (
    <PageContainer className='gap-6'>
      <div className='flex flex-col gap-2'>
        <Link
          to='/admin/logs'
          search={{ hours: 24 }}
          className='inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ChevronLeft className='size-4' />
          {content.backLink}
        </Link>
        <div className={`border-l-[3px] pl-3.5 ${runStatusAccent[run.status]}`}>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='text-2xl font-bold tracking-tight'>{triggerLabel(run)}</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {runKindLabel[run.kind]} · {formatAbsolute(run.startedAt)} ({formatRelative(run.startedAt)})
          </p>
        </div>
      </div>

      <section aria-label={content.stats.ariaLabel.value} className='grid grid-cols-4 gap-6 max-lg:grid-cols-2'>
        <StatTile
          label={content.stats.total.label.value}
          value={run.total}
          unit={content.stats.unit.value}
          note={content.stats.total.note.value}
          tone='primary'
        />
        <StatTile
          label={content.stats.succeeded.label.value}
          value={run.succeeded}
          unit={content.stats.unit.value}
          note={content.stats.succeeded.note.value}
          tone='ok'
        />
        <StatTile
          label={content.stats.failed.label.value}
          value={run.failed}
          unit={content.stats.unit.value}
          note={content.stats.failed.note.value}
          tone='err'
        />
        <StatTile
          label={content.stats.retried.label.value}
          value={run.retried}
          unit={content.stats.unit.value}
          note={content.stats.retried.note.value}
          tone='warn'
        />
      </section>

      <section aria-label={content.detail.ariaLabel.value} className='flex flex-col'>
        <Row label={content.detail.idLabel.value}>
          <span className='font-mono text-[12px] break-all'>{run.id}</span>
        </Row>
        <Row label={content.detail.triggerLabel.value}>
          <span className='font-mono text-[12px]'>{run.trigger}</span>
        </Row>
        <Row label={content.detail.durationLabel.value}>{formatDuration(run.durationMs)}</Row>
        <Row label={content.detail.finishedLabel.value}>
          {run.finishedAt === null ? (
            <span className='text-muted-foreground'>{content.detail.notFinished}</span>
          ) : (
            formatAbsolute(run.finishedAt)
          )}
        </Row>
        <Row label={content.detail.animeLabel.value}>
          <span className='tabular-nums'>
            {content.detail.animeSummary({
              created: run.animeCreated.toLocaleString('ja-JP'),
              updated: run.animeUpdated.toLocaleString('ja-JP')
            })}
          </span>
        </Row>
        {run.parentId === null ? null : (
          <Row label={content.detail.parentLabel.value}>
            <Link
              to='/admin/logs/$runId'
              params={{ runId: run.parentId }}
              className='font-mono text-[12px] underline underline-offset-2'
            >
              {run.parentId}
            </Link>
          </Row>
        )}
        {run.errorMessage === null ? null : (
          <Row label={content.detail.errorLabel.value}>
            <span className='break-all text-destructive'>{run.errorMessage}</span>
          </Row>
        )}
        {meta === null ? null : (
          <Row label={content.detail.metaLabel.value}>
            <pre className='overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-[11px]'>{meta}</pre>
          </Row>
        )}
      </section>

      <section aria-label={content.children.ariaLabel.value} className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold'>
          {content.children.heading({ count: data.children.length.toLocaleString('ja-JP') })}
        </h2>
        {data.children.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{content.children.empty}</p>
        ) : (
          <RunsTable runs={data.children} />
        )}
      </section>

      <section aria-label={content.entries.ariaLabel.value} className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold'>
          {content.entries.heading({ count: data.entries.length.toLocaleString('ja-JP') })}
        </h2>
        {data.entries.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{content.entries.empty}</p>
        ) : (
          <EntriesTable entries={data.entries} />
        )}
      </section>
    </PageContainer>
  )
}
