import { useIntlayer } from 'react-intlayer'
import { DataSub, DataTable, DataTd, DataTh, DataTr } from '@/app/components/data-table'
import { appLocale } from '@/app/lib/locale'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { CronStatSchema } from '@/schemas/log.dto'
import { formatDuration, runStatusTone } from '../-lib/format'
import { RunStatusBadge, StatusPill } from './runs-table'

/**
 * wrangler.toml の cron 定義と sync_runs を突き合わせた表。
 * 一度も実行されていない cron は行頭を destructive にして目立たせる (式の不一致が見つかる)。
 */
export const CronTable = ({ crons }: { crons: CronStatSchema[] }) => {
  const content = useIntlayer('admin-logs-cron-table')
  return (
    <DataTable
      head={
        <>
          <DataTh>{content.headers.schedule}</DataTh>
          <DataTh>{content.headers.cronExpr}</DataTh>
          <DataTh>{content.headers.lastRun}</DataTh>
          <DataTh>{content.headers.result}</DataTh>
          <DataTh right>{content.headers.duration}</DataTh>
        </>
      }
    >
      {crons.map((c) => (
        <DataTr key={c.cron} tone={c.lastRun === null ? 'err' : runStatusTone[c.lastRun.status]}>
          <DataTd>{c.label}</DataTd>
          <DataTd mono>{c.cron}</DataTd>
          {c.lastRun === null ? (
            <>
              <DataTd>
                <StatusPill className='bg-destructive/10 text-destructive'>{content.neverRun}</StatusPill>
              </DataTd>
              <DataTd sub>—</DataTd>
              <DataTd right>—</DataTd>
            </>
          ) : (
            <>
              <DataTd>
                <div>{formatRelative(c.lastRun.startedAt)}</div>
                <DataSub>{formatAbsolute(c.lastRun.startedAt)}</DataSub>
              </DataTd>
              <DataTd>
                <RunStatusBadge status={c.lastRun.status} />
                <DataSub>
                  {content.succeededFailed({
                    succeeded: c.lastRun.succeeded.toLocaleString(appLocale),
                    failed: c.lastRun.failed.toLocaleString(appLocale)
                  })}
                </DataSub>
              </DataTd>
              <DataTd right>{formatDuration(c.lastRun.durationMs)}</DataTd>
            </>
          )}
        </DataTr>
      ))}
    </DataTable>
  )
}
