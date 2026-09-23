import { Link } from '@tanstack/react-router'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { SyncRunSchema } from '@/schemas/log.dto'
import {
  formatDuration,
  runKindLabel,
  runStatusAccent,
  runStatusBadge,
  runStatusLabel,
  triggerLabel
} from '../-lib/format'

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-middle max-sm:px-[5px] max-sm:py-[9px]'
const numClass = `${cellClass} text-right tabular-nums`
const numHeadClass = `${headClass} text-right`

export const RunStatusBadge = ({ status }: { status: SyncRunSchema['status'] }) => (
  <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-semibold ${runStatusBadge[status]}`}>
    {runStatusLabel[status]}
  </span>
)

/** 実行履歴の一覧。成功数と失敗数は 1 セルに詰めず別列にする。 */
export const RunsTable = ({ runs }: { runs: SyncRunSchema[] }) => (
  <div className='overflow-x-auto'>
    <table className='w-full border-collapse text-[13px]'>
      <thead>
        <tr className='border-b border-border'>
          <th scope='col' className={`${headClass} pl-[13px]`}>
            開始
          </th>
          <th scope='col' className={headClass}>
            種別
          </th>
          <th scope='col' className={headClass}>
            トリガー
          </th>
          <th scope='col' className={headClass}>
            状態
          </th>
          <th scope='col' className={numHeadClass}>
            対象
          </th>
          <th scope='col' className={numHeadClass}>
            成功
          </th>
          <th scope='col' className={numHeadClass}>
            失敗
          </th>
          <th scope='col' className={numHeadClass}>
            所要
          </th>
          <th scope='col' className={headClass}>
            <span className='sr-only'>詳細</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id} className='border-b border-border transition-colors hover:bg-muted'>
            <td className={`${cellClass} border-l-[3px] ${runStatusAccent[run.status]}`}>
              <div className='whitespace-nowrap font-medium'>{formatRelative(run.startedAt)}</div>
              <div className='text-[11px] text-muted-foreground'>{formatAbsolute(run.startedAt)}</div>
            </td>
            <td className={cellClass}>{runKindLabel[run.kind]}</td>
            <td className={cellClass}>
              <div className='truncate'>{triggerLabel(run)}</div>
              {run.kind === 'cron' && <div className='font-mono text-[11px] text-muted-foreground'>{run.trigger}</div>}
            </td>
            <td className={cellClass}>
              <RunStatusBadge status={run.status} />
              {run.errorMessage === null ? null : (
                <div className='mt-0.5 line-clamp-1 max-w-[22rem] text-[11px] text-destructive'>{run.errorMessage}</div>
              )}
            </td>
            <td className={numClass}>{run.total.toLocaleString('ja-JP')}</td>
            <td className={numClass}>{run.succeeded.toLocaleString('ja-JP')}</td>
            <td className={`${numClass} ${run.failed > 0 ? 'font-semibold text-destructive' : ''}`}>
              {run.failed.toLocaleString('ja-JP')}
            </td>
            <td className={`${numClass} whitespace-nowrap text-muted-foreground`}>{formatDuration(run.durationMs)}</td>
            <td className={`${cellClass} text-right`}>
              <Link
                to='/admin/logs/$runId'
                params={{ runId: run.id }}
                className='inline-flex h-7 items-center rounded-md border border-border px-2.5 text-[12px] font-medium transition-colors hover:bg-background'
              >
                詳細
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
