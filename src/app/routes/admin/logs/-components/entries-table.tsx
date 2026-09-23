import { Link } from '@tanstack/react-router'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import type { LogEntrySchema } from '@/schemas/log.dto'
import { logLevelAccent, logLevelBadge, logLevelLabel } from '../-lib/format'

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-top max-sm:px-[5px] max-sm:py-[9px]'

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

/** 生ログの一覧 (新しい順)。level は行頭のアクセントとバッジの両方で示す。 */
export const EntriesTable = ({ entries }: { entries: LogEntrySchema[] }) => (
  <div className='overflow-x-auto'>
    <table className='w-full border-collapse text-[13px]'>
      <thead>
        <tr className='border-b border-border'>
          <th scope='col' className={`${headClass} pl-[13px]`}>
            時刻
          </th>
          <th scope='col' className={headClass}>
            レベル
          </th>
          <th scope='col' className={headClass}>
            カテゴリ
          </th>
          <th scope='col' className={headClass}>
            アクション
          </th>
          <th scope='col' className={`${headClass} w-full`}>
            内容
          </th>
          <th scope='col' className={headClass}>
            <span className='sr-only'>実行</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id} className='border-b border-border transition-colors hover:bg-muted'>
            <td className={`${cellClass} border-l-[3px] ${logLevelAccent[entry.level]}`}>
              <div className='whitespace-nowrap font-medium'>{formatRelative(entry.ts)}</div>
              <div className='whitespace-nowrap text-[11px] text-muted-foreground'>{formatAbsolute(entry.ts)}</div>
            </td>
            <td className={cellClass}>
              <LogLevelBadge level={entry.level} />
            </td>
            <td className={`${cellClass} whitespace-nowrap font-mono text-[11px] text-muted-foreground`}>
              {entry.category}
            </td>
            <td className={`${cellClass} whitespace-nowrap font-mono text-[11px]`}>{entry.action ?? '—'}</td>
            <td className={cellClass}>
              <div className='break-all'>{entry.summary ?? '—'}</div>
              {entry.props === null ? null : (
                <details className='mt-1'>
                  <summary className='cursor-pointer text-[11px] text-muted-foreground'>props</summary>
                  <pre className='mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap'>
                    {prettyProps(entry.props)}
                  </pre>
                </details>
              )}
            </td>
            <td className={`${cellClass} text-right`}>
              {entry.runId === null ? (
                <span className='text-[11px] text-muted-foreground'>—</span>
              ) : (
                <Link
                  to='/admin/logs/$runId'
                  params={{ runId: entry.runId }}
                  className='inline-flex h-7 items-center rounded-md border border-border px-2.5 text-[12px] font-medium transition-colors hover:bg-background'
                >
                  実行
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
