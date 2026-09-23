import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { CronStatSchema } from '@/schemas/log.dto'
import { formatDuration, runStatusAccent } from '../-lib/format'
import { RunStatusBadge } from './runs-table'

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-middle max-sm:px-[5px] max-sm:py-[9px]'

/**
 * wrangler.toml の cron 定義と sync_runs を突き合わせた表。
 * 一度も実行されていない cron は行頭を destructive にして目立たせる (式の不一致が見つかる)。
 */
export const CronTable = ({ crons }: { crons: CronStatSchema[] }) => (
  <div className='overflow-x-auto'>
    <table className='w-full border-collapse text-[13px]'>
      <thead>
        <tr className='border-b border-border'>
          <th scope='col' className={`${headClass} pl-[13px]`}>
            スケジュール
          </th>
          <th scope='col' className={headClass}>
            cron 式
          </th>
          <th scope='col' className={headClass}>
            最終実行
          </th>
          <th scope='col' className={headClass}>
            結果
          </th>
          <th scope='col' className={`${headClass} text-right`}>
            所要
          </th>
        </tr>
      </thead>
      <tbody>
        {crons.map((c) => (
          <tr key={c.cron} className='border-b border-border transition-colors hover:bg-muted'>
            <td
              className={`${cellClass} border-l-[3px] ${c.lastRun === null ? 'border-l-destructive' : runStatusAccent[c.lastRun.status]}`}
            >
              <span className='font-medium'>{c.label}</span>
            </td>
            <td className={`${cellClass} font-mono text-[12px] text-muted-foreground`}>{c.cron}</td>
            <td className={cellClass}>
              {c.lastRun === null ? (
                <span className='text-[12px] font-medium text-destructive'>一度も実行されていない</span>
              ) : (
                <>
                  <div className='whitespace-nowrap font-medium'>{formatRelative(c.lastRun.startedAt)}</div>
                  <div className='text-[11px] text-muted-foreground'>{formatAbsolute(c.lastRun.startedAt)}</div>
                </>
              )}
            </td>
            <td className={cellClass}>
              {c.lastRun === null ? (
                <span className='text-muted-foreground'>—</span>
              ) : (
                <>
                  <RunStatusBadge status={c.lastRun.status} />
                  <span className='ml-2 text-[11px] text-muted-foreground tabular-nums'>
                    成功 {c.lastRun.succeeded.toLocaleString('ja-JP')} / 失敗 {c.lastRun.failed.toLocaleString('ja-JP')}
                  </span>
                </>
              )}
            </td>
            <td className={`${cellClass} whitespace-nowrap text-right tabular-nums text-muted-foreground`}>
              {c.lastRun === null ? '—' : formatDuration(c.lastRun.durationMs)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
