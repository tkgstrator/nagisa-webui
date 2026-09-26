import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { useIntlayer } from 'react-intlayer'
import { ProxyImage } from '@/app/components/proxy-image'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { providerColor, providerLabel, statusColor, statusLabel } from '@/app/lib/constants'
import { cn } from '@/app/lib/utils'
import { useSettings } from '@/app/routes/settings/-lib/settings'
import type { AnimeSchema } from '@/schemas/anime.dto'
import { daysUntil, formatAbsolute, formatDate, formatRelative, seasonLabel } from './format'
import type { SortValue } from './recordings-toolbar'

/** 行頭のアクセント色。録画済み → success、配信終了予定 → warning、それ以外 → border。 */
const rowAccent = (anime: AnimeSchema): string => {
  if (anime.recorded) return 'border-l-success'
  if (anime.expiredAt !== null) return 'border-l-warning'
  return 'border-l-border'
}

type SortKey = 'title' | 'updatedAt'

/** 並べ替え select の値から、その列が昇順/降順のどちらで並んでいるかを引く。 */
const sortStateOf = (key: SortKey, sort: SortValue): 'ascending' | 'descending' | undefined => {
  if (key === 'title') return sort === 'title-asc' ? 'ascending' : undefined
  return sort === 'updatedAt-desc' ? 'descending' : sort === 'updatedAt-asc' ? 'ascending' : undefined
}

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-middle max-sm:px-[5px] max-sm:py-[9px]'

type SortableHeadProps = {
  label: string
  sortKey: SortKey
  sort: SortValue
  onSortChange: (value: SortValue) => void
  className?: string
}

const SortableHead = ({ label, sortKey, sort, onSortChange, className = '' }: SortableHeadProps) => {
  const state = sortStateOf(sortKey, sort)
  const next: SortValue =
    sortKey === 'title' ? 'title-asc' : sort === 'updatedAt-desc' ? 'updatedAt-asc' : 'updatedAt-desc'
  return (
    <th scope='col' aria-sort={state} className={cn(headClass, state !== undefined && 'text-foreground', className)}>
      <button
        type='button'
        onClick={() => onSortChange(next)}
        className='inline-flex items-center gap-0.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
      >
        {label}
        {state === undefined ? null : (
          <span className='ml-[3px] text-primary'>{state === 'ascending' ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  )
}

const Row = ({ anime }: { anime: AnimeSchema }) => {
  const { settings } = useSettings()
  const content = useIntlayer('recordings-recordings-table')
  const season = seasonLabel(anime.year, anime.quarter)
  const remaining = anime.expiredAt === null ? null : daysUntil(anime.expiredAt)
  return (
    <tr className='border-b border-border transition-colors focus-within:bg-muted hover:bg-muted'>
      <td className={cn(cellClass, 'border-l-[3px]', rowAccent(anime))}>
        <div className='flex min-w-0 items-center gap-3 max-sm:gap-2'>
          <div className='group relative aspect-video w-[88px] shrink-0 overflow-hidden rounded-md max-sm:w-[60px]'>
            <ProxyImage
              src={anime.imageUrl}
              alt={anime.title}
              slotWidth={88}
              className='size-full object-cover transition-transform duration-300 group-hover:scale-[1.06]'
            />
          </div>
          <div className='min-w-0 flex-1 overflow-hidden'>
            <Link
              to='/anime/$id'
              params={{ id: anime.id }}
              className='block truncate font-semibold hover:underline hover:underline-offset-2'
            >
              {anime.title}
            </Link>
            <div className='mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground'>
              {season === null ? null : <span>{season}</span>}
              {anime.nextEpisodeDate === null ? null : (
                <span>
                  {content.nextEpisodePrefix}
                  {formatDate(anime.nextEpisodeDate)}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className={cellClass}>
        <StatusBadge size='sm' className={providerColor[anime.provider] ?? 'bg-muted text-muted-foreground'}>
          {providerLabel[anime.provider] ?? anime.provider}
        </StatusBadge>
      </td>
      <td className={cellClass}>
        <StatusBadge size='sm' className={statusColor[anime.status] ?? 'bg-muted text-muted-foreground'}>
          {statusLabel[anime.status] ?? anime.status}
        </StatusBadge>
      </td>
      <td className={cellClass}>
        <StatusBadge size='sm' variant='solid' tone={anime.recorded ? 'success' : 'muted'}>
          {anime.recorded ? content.recordedBadge.recorded : content.recordedBadge.pending}
        </StatusBadge>
      </td>
      <td className={cellClass}>
        <span className='block text-[12.5px]'>{formatRelative(anime.updatedAt)}</span>
        <span className='block text-[11px] text-muted-foreground tabular-nums'>{formatAbsolute(anime.updatedAt)}</span>
      </td>
      <td className={cn(cellClass, 'text-xs text-muted-foreground tabular-nums max-sm:px-[5px] max-sm:py-[9px]')}>
        {anime.expiredAt === null ? (
          '—'
        ) : (
          <>
            <span
              className={
                remaining !== null && remaining <= settings.expiringLeadDays ? 'font-semibold text-destructive' : ''
              }
            >
              {formatDate(anime.expiredAt)}
            </span>
            <span className='block text-[11px]'>{content.remainingDays({ days: remaining })}</span>
          </>
        )}
      </td>
    </tr>
  )
}

const GroupRow = ({ label, count, hint }: { label: string; count: number; hint: string }) => {
  const content = useIntlayer('recordings-recordings-table')
  return (
    <tr>
      <th
        colSpan={6}
        scope='colgroup'
        className='border-b border-border px-2.5 pt-[18px] pb-1.5 pl-[13px] text-left text-xs font-semibold text-muted-foreground'
      >
        {label}
        <span className='ml-1.5 font-medium tabular-nums'>{content.groupCount({ count })}</span>
        <span className='ml-2.5 text-[11px] font-normal opacity-80'>{hint}</span>
      </th>
    </tr>
  )
}

type RecordingsTableProps = {
  items: AnimeSchema[]
  sort: SortValue
  onSortChange: (value: SortValue) => void
}

export const RecordingsTable = ({ items, sort, onSortChange }: RecordingsTableProps) => {
  const content = useIntlayer('recordings-recordings-table')
  const airing = items.filter((anime) => anime.status === 'RELEASING')
  const finished = items.filter((anime) => anime.status === 'FINISHED')
  const others = items.filter((anime) => anime.status !== 'RELEASING' && anime.status !== 'FINISHED')
  const groups = [
    { key: 'airing', label: content.groups.airing.label.value, hint: content.groups.airing.hint.value, items: airing },
    {
      key: 'finished',
      label: content.groups.finished.label.value,
      hint: content.groups.finished.hint.value,
      items: finished
    },
    { key: 'others', label: content.groups.others.label.value, hint: content.groups.others.hint.value, items: others }
  ].filter((group) => group.items.length > 0)

  return (
    <div className='min-w-0 max-sm:overflow-x-auto'>
      <table className='w-full table-fixed border-collapse text-sm max-sm:min-w-[656px]'>
        <colgroup>
          <col />
          <col className='w-[104px]' />
          <col className='w-[76px]' />
          <col className='w-[88px]' />
          <col className='w-[112px]' />
          <col className='w-24' />
        </colgroup>
        <thead>
          <tr className='border-b border-border'>
            <SortableHead label={content.columns.title.value} sortKey='title' sort={sort} onSortChange={onSortChange} />
            <th scope='col' className={headClass}>
              {content.columns.provider}
            </th>
            <th scope='col' className={headClass}>
              {content.columns.airing}
            </th>
            <th scope='col' className={headClass}>
              {content.columns.recorded}
            </th>
            <SortableHead
              label={content.columns.updatedAt.value}
              sortKey='updatedAt'
              sort={sort}
              onSortChange={onSortChange}
            />
            <th scope='col' className={headClass}>
              {content.columns.expiresAt}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <GroupRow label={group.label} count={group.items.length} hint={group.hint} />
              {group.items.map((anime) => (
                <Row key={anime.id} anime={anime} />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
