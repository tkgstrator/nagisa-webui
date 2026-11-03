import { Link } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'
import { DataSub, DataTable, DataTd, DataTh, DataTr, type RowTone } from '@/app/components/data-table'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { LogEntrySchema } from '@/schemas/log.dto'
import { logLevelBadge, logLevelLabel } from '../-lib/format'

export const LogLevelBadge = ({ level }: { level: LogEntrySchema['level'] }) => (
  <span
    className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-semibold ${logLevelBadge[level]}`}
  >
    {logLevelLabel[level]}
  </span>
)

/** props は JSON 文字列のまま来るので、読める形に直せたときだけ整形する。 */
const prettyProps = (props: string): string => {
  try {
    return JSON.stringify(JSON.parse(props), null, 2)
  } catch {
    return props
  }
}

/** 行頭のトーン。debug / info は付けず、warning 以上だけ色で拾えるようにする。 */
const levelTone: Record<LogEntrySchema['level'], RowTone | undefined> = {
  debug: undefined,
  info: undefined,
  warning: 'warn',
  error: 'err',
  fatal: 'err'
}

/** 生ログの一覧 (新しい順)。実行履歴と同じ表で、level は行頭のトーンとバッジの両方で示す。 */
export const EntriesTable = ({ entries }: { entries: LogEntrySchema[] }) => {
  const content = useIntlayer('admin-logs-entries-table')
  return (
    <DataTable
      head={
        <>
          <DataTh>{content.headers.time}</DataTh>
          <DataTh>{content.headers.level}</DataTh>
          <DataTh>{content.headers.category}</DataTh>
          <DataTh>{content.headers.action}</DataTh>
          <DataTh>{content.headers.content}</DataTh>
          <DataTh right>{content.run}</DataTh>
        </>
      }
    >
      {entries.map((entry) => (
        <DataTr key={entry.id} tone={levelTone[entry.level]}>
          <DataTd>
            <div className='whitespace-nowrap'>{formatRelative(entry.ts)}</div>
            <DataSub>{formatAbsolute(entry.ts)}</DataSub>
          </DataTd>
          <DataTd>
            <LogLevelBadge level={entry.level} />
          </DataTd>
          <DataTd mono className='whitespace-nowrap text-muted-foreground'>
            {entry.category}
          </DataTd>
          <DataTd mono className='whitespace-nowrap'>
            {entry.action ?? '—'}
          </DataTd>
          <DataTd className='w-full'>
            <div className='break-all'>{entry.summary ?? '—'}</div>
            {entry.props === null ? null : (
              <details className='mt-1'>
                <summary className='cursor-pointer text-[11px] text-muted-foreground'>props</summary>
                <pre className='mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap'>
                  {prettyProps(entry.props)}
                </pre>
              </details>
            )}
          </DataTd>
          <DataTd right className='whitespace-nowrap'>
            {entry.runId === null ? (
              <span className='text-muted-foreground'>—</span>
            ) : (
              <Link
                to='/admin/logs/$runId'
                params={{ runId: entry.runId }}
                className='font-semibold text-primary hover:underline'
              >
                {content.run}
              </Link>
            )}
          </DataTd>
        </DataTr>
      ))}
    </DataTable>
  )
}
