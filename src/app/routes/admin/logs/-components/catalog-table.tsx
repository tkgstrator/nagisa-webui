import { Link } from '@tanstack/react-router'
import type { CatalogEventSchema } from '@/schemas/log.dto'
import { catalogAccent, catalogFieldLabel, catalogKindLabel, formatClock, formatDay } from '../-lib/format'
import { EmptyRows, ProviderBadge, rowAccentClass, rowClass, SkeletonRows } from './recordings-table'

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'px-2.5 py-[7px] align-top max-sm:px-[5px] max-sm:py-[7px]'
const numClass = `${cellClass} text-right text-[12.5px] tabular-nums`
const numHeadClass = `${headClass} text-right`

/** 「S1 E5–7」と変わった項目のチップ。新規タイトルには中身が無いので — を出す */
const CatalogDetail = ({ event }: { event: CatalogEventSchema }) => {
  const fields = event.fields ?? []
  if (event.episodes === null && event.seasonNumber === null && fields.length === 0) {
    return <span className='text-muted-foreground'>—</span>
  }
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
      {event.episodes !== null ? (
        <span className='truncate font-mono text-[12px]'>{event.episodes}</span>
      ) : event.seasonNumber !== null ? (
        <span className='font-mono text-[12px]'>S{event.seasonNumber}</span>
      ) : null}
      {fields.map((f) => (
        <span key={f} className='rounded-full bg-muted px-1.5 text-[10px] whitespace-nowrap text-muted-foreground'>
          {catalogFieldLabel[f]}
        </span>
      ))}
    </div>
  )
}

/**
 * カタログに入った変化の一覧。録画イベントの表と同じ読み順 (いつ / どの作品 / 何が) に揃え、
 * エピソードの追加・更新は 1 回の同期につき作品単位 1 行で、どの話かは「内容」列に畳んで出す。
 */
export const CatalogTable = ({ events }: { events: CatalogEventSchema[] | undefined }) => {
  if (events === undefined)
    return (
      <SkeletonRows widths={['w-[74px]', 'flex-1', 'w-[92px] max-sm:hidden', 'w-24', 'w-32 max-sm:hidden', 'w-11']} />
    )
  if (events.length === 0) return <EmptyRows message='この期間のカタログ変化はありません' />
  return (
    <div className='overflow-x-auto'>
      <table className='w-full border-collapse text-[13px]'>
        <thead>
          <tr className='border-b border-border'>
            <th scope='col' className={`${headClass} pl-[13px]`}>
              日時
            </th>
            <th scope='col' className={headClass}>
              作品
            </th>
            <th scope='col' className={`${headClass} max-sm:hidden`}>
              配信元
            </th>
            <th scope='col' className={headClass}>
              種別
            </th>
            <th scope='col' className={`${headClass} max-sm:hidden`}>
              内容
            </th>
            <th scope='col' className={numHeadClass}>
              話数
            </th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className={rowClass}>
              <td className={`${cellClass} ${rowAccentClass(catalogAccent[event.kind])}`}>
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
              </td>
              <td className={`${cellClass} max-sm:hidden`}>
                <ProviderBadge provider={event.provider} />
              </td>
              <td className={`${cellClass} text-[11.5px] whitespace-nowrap`}>{catalogKindLabel[event.kind]}</td>
              <td className={`${cellClass} max-sm:hidden`}>
                <CatalogDetail event={event} />
              </td>
              <td className={`${numClass} ${event.episodeCount === null ? 'text-muted-foreground' : ''}`}>
                {event.episodeCount === null ? '—' : event.episodeCount.toLocaleString('ja-JP')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
