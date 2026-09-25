import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useIntlayer } from 'react-intlayer'
import { DataSub, DataTable, DataTd, DataTh, DataTr } from '@/app/components/data-table'
import { appLocale } from '@/app/lib/locale'
import { cn } from '@/app/lib/utils'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { SyncRunSchema } from '@/schemas/log.dto'
import {
  formatDuration,
  runKindLabel,
  runStatusBadge,
  runStatusLabel,
  runStatusTone,
  triggerLabel
} from '../-lib/format'

/** 決定稿の `.a-badge.a-sm`。表の中に置く小さな丸い札。 */
export const StatusPill = ({ className, children }: { className: string; children: ReactNode }) => (
  <span
    className={cn(
      'inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-semibold whitespace-nowrap',
      className
    )}
  >
    {children}
  </span>
)

export const RunStatusBadge = ({ status }: { status: SyncRunSchema['status'] }) => (
  <StatusPill className={runStatusBadge[status]}>{runStatusLabel[status]}</StatusPill>
)

/** 実行履歴の一覧。成功数と失敗数は 1 セルに詰めず別列にする。 */
export const RunsTable = ({ runs }: { runs: SyncRunSchema[] }) => {
  const content = useIntlayer('admin-logs-runs-table')
  return (
    <DataTable
      head={
        <>
          <DataTh>{content.headers.startedAt}</DataTh>
          <DataTh>{content.headers.kind}</DataTh>
          <DataTh>{content.headers.trigger}</DataTh>
          <DataTh>{content.headers.status}</DataTh>
          <DataTh right>{content.headers.total}</DataTh>
          <DataTh right>{content.headers.succeeded}</DataTh>
          <DataTh right>{content.headers.failed}</DataTh>
          <DataTh right>{content.headers.duration}</DataTh>
          <DataTh right>{content.detail}</DataTh>
        </>
      }
    >
      {runs.map((run) => (
        <DataTr key={run.id} tone={runStatusTone[run.status]}>
          <DataTd>
            <div className='whitespace-nowrap'>{formatRelative(run.startedAt)}</div>
            <DataSub>{formatAbsolute(run.startedAt)}</DataSub>
          </DataTd>
          <DataTd>{runKindLabel[run.kind]}</DataTd>
          <DataTd mono={run.errorMessage === null}>
            {triggerLabel(run)}
            {run.errorMessage !== null && <DataSub>{run.errorMessage}</DataSub>}
          </DataTd>
          <DataTd>
            <RunStatusBadge status={run.status} />
          </DataTd>
          <DataTd right>{run.total.toLocaleString(appLocale)}</DataTd>
          <DataTd right>{run.succeeded.toLocaleString(appLocale)}</DataTd>
          <DataTd right>{run.failed > 0 ? <b>{run.failed.toLocaleString(appLocale)}</b> : '0'}</DataTd>
          <DataTd right className='whitespace-nowrap'>
            {formatDuration(run.durationMs)}
          </DataTd>
          <DataTd right>
            <Link
              to='/admin/logs/$runId'
              params={{ runId: run.id }}
              className='font-semibold text-primary hover:underline'
            >
              {content.detail}
            </Link>
          </DataTd>
        </DataTr>
      ))}
    </DataTable>
  )
}
