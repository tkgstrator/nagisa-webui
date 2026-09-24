import { Link } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'
import { providerColor, providerLabel } from '@/app/lib/constants'
import type { RecordingEventSchema } from '@/schemas/log.dto'
import {
  formatClock,
  formatDay,
  recordingAccent,
  recordingKindLabel,
  recordingSourceLabel,
  recordingStatusBadge,
  recordingStatusLabel
} from '../-lib/format'

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-top max-sm:px-[5px] max-sm:py-[9px]'
const numClass = `${cellClass} text-right tabular-nums`
const numHeadClass = `${headClass} text-right`

export const RecordingStatusBadge = ({ status }: { status: RecordingEventSchema['status'] }) => (
  <span
    className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-semibold ${recordingStatusBadge[status]}`}
  >
    {recordingStatusLabel[status]}
  </span>
)

/**
 * 録画イベントの一覧。1 行 = 出来事 1 件で、いつ / どの作品 / 何をした / どこから / 結果は、
 * の順に左から読ませる。話数と HTTP ステータスは 1 枠に詰めず別の列に置く
 * (詰めると値が無いときにどちらが欠けているのか読めない)。
 */
export const RecordingsTable = ({ events }: { events: RecordingEventSchema[] }) => {
  const content = useIntlayer('admin-logs-recordings-table')
  return (
    <div className='overflow-x-auto'>
      <table className='w-full border-collapse text-[13px]'>
        <thead>
          <tr className='border-b border-border'>
            <th scope='col' className={`${headClass} pl-[13px]`}>
              {content.headers.dateTime}
            </th>
            <th scope='col' className={headClass}>
              {content.headers.anime}
            </th>
            <th scope='col' className={headClass}>
              {content.headers.kind}
            </th>
            <th scope='col' className={`${headClass} max-sm:hidden`}>
              {content.headers.route}
            </th>
            <th scope='col' className={numHeadClass}>
              {content.headers.episode}
            </th>
            <th scope='col' className={`${numHeadClass} max-sm:hidden`}>
              HTTP
            </th>
            <th scope='col' className={numHeadClass}>
              {content.headers.result}
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className='border-b border-border transition-colors hover:bg-muted'>
              <td className={`${cellClass} border-l-[3px] ${recordingAccent(event)}`}>
                <div className='whitespace-nowrap font-medium tabular-nums'>{formatClock(event.createdAt)}</div>
                <div className='text-[11px] text-muted-foreground'>{formatDay(event.createdAt)}</div>
              </td>
              <td className={cellClass}>
                <div className='flex flex-wrap items-center gap-1.5'>
                  <Link
                    to='/anime/$id'
                    params={{ id: event.animeId }}
                    className='font-medium transition-colors hover:text-primary'
                  >
                    {event.title === '' ? event.contentId : event.title}
                  </Link>
                  <span
                    className={`inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold ${providerColor[event.provider] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {providerLabel[event.provider] ?? event.provider}
                  </span>
                </div>
                {event.errorMessage === null ? null : (
                  <div className='mt-0.5 line-clamp-2 max-w-[28rem] text-[11px] text-destructive'>
                    {event.errorMessage}
                  </div>
                )}
              </td>
              <td className={`${cellClass} whitespace-nowrap`}>{recordingKindLabel[event.kind]}</td>
              <td className={`${cellClass} whitespace-nowrap text-muted-foreground max-sm:hidden`}>
                {recordingSourceLabel[event.source]}
              </td>
              <td className={`${numClass} ${event.episodeCount === null ? 'text-muted-foreground' : ''}`}>
                {event.episodeCount === null ? '—' : event.episodeCount.toLocaleString('ja-JP')}
              </td>
              <td
                className={`${numClass} max-sm:hidden ${event.httpStatus === null ? 'text-muted-foreground' : 'font-mono'}`}
              >
                {event.httpStatus === null ? '—' : event.httpStatus}
              </td>
              <td className={`${cellClass} text-right`}>
                <RecordingStatusBadge status={event.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
