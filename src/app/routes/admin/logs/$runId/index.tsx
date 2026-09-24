import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
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
  const { runId } = Route.useParams()
  const { data } = useQuery(syncRunQueryOptions(runId))

  if (data === undefined) {
    return (
      <PageContainer className='gap-6'>
        <p className='border-l-[3px] border-destructive px-3.5 py-3 text-sm text-muted-foreground'>
          実行記録を取得できませんでした
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
          同期ログ
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

      <section aria-label='件数' className='grid grid-cols-4 gap-6 max-lg:grid-cols-2'>
        <StatTile label='対象' value={run.total} unit='件' note='この実行が扱った件数' tone='primary' />
        <StatTile label='成功' value={run.succeeded} unit='件' note='正常に処理できた件数' tone='ok' />
        <StatTile label='失敗' value={run.failed} unit='件' note='エラーで落ちた件数' tone='err' />
        <StatTile label='再試行' value={run.retried} unit='件' note='キューへ戻した件数' tone='warn' />
      </section>

      <section aria-label='実行の詳細' className='flex flex-col'>
        <Row label='ID'>
          <span className='font-mono text-[12px] break-all'>{run.id}</span>
        </Row>
        <Row label='トリガー'>
          <span className='font-mono text-[12px]'>{run.trigger}</span>
        </Row>
        <Row label='所要'>{formatDuration(run.durationMs)}</Row>
        <Row label='終了'>
          {run.finishedAt === null ? (
            <span className='text-muted-foreground'>まだ終わっていない</span>
          ) : (
            formatAbsolute(run.finishedAt)
          )}
        </Row>
        <Row label='作品'>
          <span className='tabular-nums'>
            新規 {run.animeCreated.toLocaleString('ja-JP')} 件 · 更新 {run.animeUpdated.toLocaleString('ja-JP')} 件
          </span>
        </Row>
        {run.parentId === null ? null : (
          <Row label='親の実行'>
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
          <Row label='エラー'>
            <span className='break-all text-destructive'>{run.errorMessage}</span>
          </Row>
        )}
        {meta === null ? null : (
          <Row label='メタ'>
            <pre className='overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-[11px]'>{meta}</pre>
          </Row>
        )}
      </section>

      <section aria-label='子の実行' className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold'>子の実行 ({data.children.length.toLocaleString('ja-JP')} 件)</h2>
        {data.children.length === 0 ? (
          <p className='text-sm text-muted-foreground'>この実行から投入されたバッチはまだありません</p>
        ) : (
          <RunsTable runs={data.children} />
        )}
      </section>

      <section aria-label='この実行のログ' className='flex flex-col gap-2'>
        <h2 className='text-sm font-semibold'>ログ ({data.entries.length.toLocaleString('ja-JP')} 件)</h2>
        {data.entriesError !== null ? (
          <p className='text-sm text-destructive'>Workers Logs から取得できませんでした: {data.entriesError}</p>
        ) : data.entries.length === 0 ? (
          <p className='text-sm text-muted-foreground'>この実行のログは残っていません (Workers Logs の保持は 7 日)</p>
        ) : (
          <EntriesTable entries={data.entries} />
        )}
      </section>
    </PageContainer>
  )
}
