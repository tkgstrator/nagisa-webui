import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { ProxyImage } from '@/app/components/proxy-image'
import { providerColor, providerLabel, statusColor, statusLabel } from '@/app/lib/constants'
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
    <th
      scope='col'
      aria-sort={state}
      className={`${headClass} ${state === undefined ? '' : 'text-foreground'} ${className}`}
    >
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

const Checkbox = ({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) => (
  <input
    type='checkbox'
    aria-label={label}
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    className='size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background transition-colors checked:border-primary checked:bg-primary checked:bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27white%27%20stroke-width%3D%273%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27m5%2013%204%204%2010-10%27%2F%3E%3C%2Fsvg%3E")] checked:bg-[length:12px_12px] checked:bg-center checked:bg-no-repeat focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
  />
)

type RowProps = {
  anime: AnimeSchema
  selected: boolean
  onToggleSelected: (id: string) => void
  onUnschedule: (anime: AnimeSchema) => void
  unscheduling: boolean
}

const Row = ({ anime, selected, onToggleSelected, onUnschedule, unscheduling }: RowProps) => {
  const { settings } = useSettings()
  const season = seasonLabel(anime.year, anime.quarter)
  const remaining = anime.expiredAt === null ? null : daysUntil(anime.expiredAt)
  return (
    <tr
      className={`border-b border-border transition-colors ${selected ? 'bg-accent/55 hover:bg-accent/75' : 'hover:bg-muted focus-within:bg-muted'}`}
    >
      <td className={`${cellClass} border-l-[3px] ${rowAccent(anime)}`}>
        <Checkbox checked={selected} onChange={() => onToggleSelected(anime.id)} label={`${anime.title} を選択`} />
      </td>
      <td className={cellClass}>
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
              {anime.nextEpisodeDate === null ? null : <span>次回 {formatDate(anime.nextEpisodeDate)}</span>}
            </div>
          </div>
        </div>
      </td>
      <td className={`${cellClass}`}>
        <span
          className={`inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-semibold ${providerColor[anime.provider] ?? 'bg-muted text-muted-foreground'}`}
        >
          {providerLabel[anime.provider] ?? anime.provider}
        </span>
      </td>
      <td className={`${cellClass}`}>
        <span
          className={`inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-semibold ${statusColor[anime.status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {statusLabel[anime.status] ?? anime.status}
        </span>
      </td>
      <td className={cellClass}>
        <span
          className={`inline-flex h-5 items-center rounded-full px-[7px] text-[11px] font-semibold whitespace-nowrap ${
            anime.recorded ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {anime.recorded ? '録画済み' : '未録画'}
        </span>
      </td>
      <td className={`${cellClass}`}>
        <span className='block text-[12.5px]'>{formatRelative(anime.updatedAt)}</span>
        <span className='block text-[11px] text-muted-foreground tabular-nums'>{formatAbsolute(anime.updatedAt)}</span>
      </td>
      <td className={`${cellClass} text-xs text-muted-foreground tabular-nums max-sm:px-[5px] max-sm:py-[9px]`}>
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
            <span className='block text-[11px]'>あと {remaining} 日</span>
          </>
        )}
      </td>
      <td className={cellClass}>
        <button
          type='button'
          aria-label={`${anime.title} の予約を解除`}
          disabled={unscheduling}
          onClick={() => onUnschedule(anime)}
          className='inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-status-cancelled hover:text-status-cancelled-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-45 max-sm:px-1'
        >
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            strokeLinecap='round'
            className='size-3.5 shrink-0'
            aria-hidden='true'
          >
            <path d='M6 6l12 12M18 6 6 18' />
          </svg>
          <span>解除</span>
        </button>
      </td>
    </tr>
  )
}

const GroupRow = ({ label, count, hint }: { label: string; count: number; hint: string }) => (
  <tr>
    <th
      colSpan={8}
      scope='colgroup'
      className='border-b border-border px-2.5 pt-[18px] pb-1.5 pl-[13px] text-left text-xs font-semibold text-muted-foreground'
    >
      {label}
      <span className='ml-1.5 font-medium tabular-nums'>{count} 作品</span>
      <span className='ml-2.5 text-[11px] font-normal opacity-80'>{hint}</span>
    </th>
  </tr>
)

type RecordingsTableProps = {
  items: AnimeSchema[]
  selected: Set<string>
  onToggleSelected: (id: string) => void
  onUnschedule: (anime: AnimeSchema) => void
  unschedulingId: string | null
  sort: SortValue
  onSortChange: (value: SortValue) => void
}

export const RecordingsTable = ({
  items,
  selected,
  onToggleSelected,
  onUnschedule,
  unschedulingId,
  sort,
  onSortChange
}: RecordingsTableProps) => {
  const airing = items.filter((anime) => anime.status === 'RELEASING')
  const others = items.filter((anime) => anime.status !== 'RELEASING')
  const groups = [
    { key: 'airing', label: '放送中', hint: '新しい話が順次追加されます', items: airing },
    { key: 'others', label: 'その他', hint: '完結・未放送・休止を含みます', items: others }
  ].filter((group) => group.items.length > 0)

  return (
    <div className='min-w-0 max-sm:overflow-x-auto'>
      <table className='w-full table-fixed border-collapse text-sm max-sm:min-w-[760px]'>
        <colgroup>
          <col className='w-10' />
          <col />
          <col className='w-[104px]' />
          <col className='w-[76px]' />
          <col className='w-[88px]' />
          <col className='w-[112px]' />
          <col className='w-24' />
          <col className='w-16' />
        </colgroup>
        <thead>
          <tr className='border-b border-border'>
            <th scope='col' className={headClass}>
              <span className='sr-only'>選択</span>
            </th>
            <SortableHead label='作品' sortKey='title' sort={sort} onSortChange={onSortChange} />
            <th scope='col' className={headClass}>
              プロバイダ
            </th>
            <th scope='col' className={headClass}>
              放送
            </th>
            <th scope='col' className={headClass}>
              録画
            </th>
            <SortableHead label='最終更新' sortKey='updatedAt' sort={sort} onSortChange={onSortChange} />
            <th scope='col' className={headClass}>
              配信終了
            </th>
            <th scope='col' className={headClass}>
              <span className='sr-only'>操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <GroupRow label={group.label} count={group.items.length} hint={group.hint} />
              {group.items.map((anime) => (
                <Row
                  key={anime.id}
                  anime={anime}
                  selected={selected.has(anime.id)}
                  onToggleSelected={onToggleSelected}
                  onUnschedule={onUnschedule}
                  unscheduling={unschedulingId === anime.id}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
