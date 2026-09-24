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
const cellClass = 'px-2.5 py-[7px] align-top max-sm:px-[5px] max-sm:py-[7px]'
const numClass = `${cellClass} text-right text-[12.5px] tabular-nums`
const numHeadClass = `${headClass} text-right`

export const RecordingStatusBadge = ({ status }: { status: RecordingEventSchema['status'] }) => (
  <span
    className={`inline-flex items-center rounded-full px-[7px] py-px text-[10.5px] font-bold whitespace-nowrap ${recordingStatusBadge[status]}`}
  >
    {recordingStatusLabel[status]}
  </span>
)

export const ProviderBadge = ({ provider }: { provider: string }) => (
  <span
    className={`inline-flex items-center rounded px-1.5 py-px text-[9.5px] font-bold whitespace-nowrap ${providerColor[provider] ?? 'bg-muted text-muted-foreground'}`}
  >
    {providerLabel[provider] ?? provider}
  </span>
)

/**
 * 行の外形。hover で背景を muted に、中のリンクにキーボードフォーカスが来たら行ごと枠を出す。
 * 行頭の罫は先頭セルが持つ (`rowAccentClass`)。
 */
export const rowClass =
  'group/row border-b border-border/60 transition-colors hover:bg-muted has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring'

/**
 * 先頭セルの罫。色の付いていない行だけ hover で primary に変える。
 * 失敗・警告の罫は hover でも上書きしない (見るべき行の印が消えるため)。
 */
export const rowAccentClass = (accent: string): string =>
  `border-l-[3px] transition-colors ${accent} ${accent === 'border-l-transparent' ? 'group-hover/row:border-l-primary' : ''}`

/** 0 件。表の外形 (行頭の罫) を残したまま中央に一言だけ置く。 */
export const EmptyRows = ({ message }: { message: string }) => (
  <div className='border-l-[3px] border-l-border py-[46px] text-center text-[13px] text-muted-foreground'>
    {message}
  </div>
)

/** 読み込み中。列幅に合わせたバーを 3 行ぶん。 */
export const SkeletonRows = ({ widths }: { widths: string[] }) => (
  <div aria-hidden='true'>
    {[0, 1, 2].map((row) => (
      <div key={row} className='flex items-center gap-2.5 py-[9px] pr-2.5 pl-[13px]'>
        {widths.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 固定長の飾り
          <span key={i} className={`h-[11px] rounded bg-muted ${w}`} />
        ))}
      </div>
    ))}
  </div>
)

/**
 * 録画イベントの一覧。1 行 = 出来事 1 件で、いつ / どの作品 / どの配信元 / 何をした / どこから / 結果は、
 * の順に左から読ませる。話数と HTTP ステータスは 1 枠に詰めず別の列に置く
 * (詰めると値が無いときにどちらが欠けているのか読めない)。
 */
export const RecordingsTable = ({ events }: { events: RecordingEventSchema[] | undefined }) => {
  const content = useIntlayer('admin-logs-recordings-table')

  if (events === undefined)
    return (
      <SkeletonRows
        widths={[
          'w-[74px]',
          'flex-1',
          'w-[92px] max-sm:hidden',
          'w-[76px]',
          'w-16 max-sm:hidden',
          'w-11',
          'w-11 max-sm:hidden',
          'w-12'
        ]}
      />
    )
  if (events.length === 0) return <EmptyRows message={content.empty.value} />
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
            <th scope='col' className={`${headClass} max-sm:hidden`}>
              {content.headers.provider}
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
              {content.headers.http}
            </th>
            <th scope='col' className={numHeadClass}>
              {content.headers.result}
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className={rowClass}>
              <td className={`${cellClass} ${rowAccentClass(recordingAccent(event))}`}>
                <div className='text-xs leading-tight whitespace-nowrap tabular-nums max-sm:text-[11px]'>
                  {formatClock(event.createdAt)}
                </div>
                <div className='text-[10.5px] leading-tight text-muted-foreground'>{formatDay(event.createdAt)}</div>
              </td>
              <td className={cellClass}>
                <Link
                  to='/anime/$id'
                  params={{ id: event.animeId }}
                  className='block truncate font-semibold transition-colors hover:text-primary focus-visible:outline-none'
                >
                  {event.title === '' ? event.contentId : event.title}
                </Link>
                {event.errorMessage === null ? null : (
                  <div className='mt-0.5 max-w-[28rem] text-[11px] break-all text-destructive'>
                    {event.errorMessage}
                  </div>
                )}
              </td>
              <td className={`${cellClass} max-sm:hidden`}>
                <ProviderBadge provider={event.provider} />
              </td>
              <td className={`${cellClass} text-[11.5px] whitespace-nowrap`}>{recordingKindLabel[event.kind]}</td>
              <td
                className={`${cellClass} font-mono text-[11px] whitespace-nowrap text-muted-foreground max-sm:hidden`}
              >
                {recordingSourceLabel[event.source]}
              </td>
              <td className={`${numClass} ${event.episodeCount === null ? 'text-muted-foreground' : ''}`}>
                {event.episodeCount === null ? '—' : event.episodeCount.toLocaleString('ja-JP')}
              </td>
              <td className={`${numClass} max-sm:hidden ${event.httpStatus === null ? 'text-muted-foreground' : ''}`}>
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
