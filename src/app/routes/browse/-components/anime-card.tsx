import dayjs from 'dayjs'
import { ProxyImage } from '@/app/components/proxy-image'
import { providerLabel } from '@/app/lib/constants'
import { type AnimeSchema, QuarterLabel } from '@/schemas/anime.dto'

/** id ごとに安定した色相。画像が来るまでのプレースホルダ専用。 */
const hueOf = (seed: string) => {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

const statusText: Record<string, { label: string; className: string }> = {
  RELEASING: { label: '放送中', className: 'text-status-releasing-foreground' },
  FINISHED: { label: '完結', className: 'text-status-finished-foreground' },
  NOT_YET_RELEASED: { label: '未放送', className: 'text-status-not-yet-foreground' },
  CANCELLED: { label: '中止', className: 'text-status-cancelled-foreground' },
  HIATUS: { label: '休止', className: 'text-status-hiatus-foreground' }
}

const badgeTag: Record<string, { label: string; className: string; pulse: boolean }> = {
  NEW_EPISODE: { label: '新着', className: 'bg-info text-info-foreground', pulse: true },
  RECENTLY_ADDED: { label: '新着追加', className: 'bg-success text-success-foreground', pulse: false },
  COMING_SOON: { label: '配信予定', className: 'bg-warning text-warning-foreground', pulse: false },
  EXPIRING: { label: '配信終了予定', className: 'bg-destructive text-destructive-foreground', pulse: false }
}

/** 一覧 API にエピソード番号が無いため、代わりに次回配信日 / 配信終了日を出す。 */
const episodeLine = (anime: AnimeSchema) => {
  if (anime.expiredAt !== null) return `${dayjs(anime.expiredAt).format('M/D')} まで`
  if (anime.nextEpisodeDate !== null) return `${dayjs(anime.nextEpisodeDate).format('M/D')} 更新`
  return null
}

export function AnimeCard({
  anime,
  index,
  filterYear,
  filterStatus,
  onFilterYear,
  onFilterStatus,
  onSelect
}: {
  anime: AnimeSchema
  index: number
  filterYear: number | undefined
  filterStatus: string | undefined
  onFilterYear: (year: number | undefined) => void
  onFilterStatus: (status: string | undefined) => void
  onSelect: (animeId: string) => void
}) {
  const hue = hueOf(anime.id)
  const tag = anime.badge !== null ? badgeTag[anime.badge] : undefined
  const status = statusText[anime.status]
  const episode = episodeLine(anime)

  return (
    <div
      style={{ '--h': hue, animationDelay: `${index * 30}ms` } as React.CSSProperties}
      className='group min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500'
    >
      <button
        type='button'
        onClick={() => onSelect(anime.id)}
        aria-label={`${anime.title} の詳細`}
        className='group/tile block w-full rounded-[10px] text-left focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      >
        <div className='relative aspect-video overflow-hidden rounded-[10px] transition-[transform,box-shadow] duration-300 ease-out after:absolute after:inset-0 after:bg-[linear-gradient(180deg,transparent_28%,var(--overlay)_100%)] after:content-[""] group-hover:-translate-y-1.5 group-hover:scale-[1.045] group-hover:shadow-[0_22px_34px_-16px_var(--overlay)]'>
          <div className='absolute inset-0 bg-[radial-gradient(120%_100%_at_25%_0%,oklch(0.82_0.11_var(--h)/85%),transparent_55%),linear-gradient(165deg,oklch(0.6_0.15_var(--h))_0%,oklch(0.32_0.13_calc(var(--h)+40))_100%)]' />
          <span
            aria-hidden='true'
            className='absolute -right-1 -top-2 text-[40px] font-extrabold leading-none text-[oklch(0.99_0.01_var(--h))] opacity-[0.16] max-sm:text-[32px]'
          >
            {anime.title.slice(0, 1)}
          </span>
          <ProxyImage
            src={anime.imageUrl}
            alt=''
            width={480}
            className='absolute inset-0 size-full object-cover [&[role=img]]:hidden'
          />

          {tag !== undefined && (
            <span
              className={`absolute left-2 top-2 z-1 inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[9.5px] font-bold ${tag.className}`}
            >
              {tag.pulse && <span className='size-[5px] animate-pulse rounded-full bg-current' />}
              {tag.label}
            </span>
          )}

          <span className='absolute inset-0 z-1 flex items-center justify-center bg-overlay/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible/tile:opacity-100'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              aria-hidden='true'
              className='size-5 text-overlay-foreground drop-shadow-[0_2px_5px_oklch(0_0_0/45%)]'
            >
              <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z' />
              <circle cx='12' cy='12' r='3' />
            </svg>
          </span>

          <div className='absolute inset-x-[9px] bottom-[9px] z-1 min-w-0 text-[oklch(0.99_0.01_var(--h))]'>
            <p className='truncate text-xs font-bold leading-[1.3] drop-shadow-[0_1px_3px_oklch(0.1_0.02_var(--h)/60%)]'>
              {anime.title}
            </p>
            <div className='mt-1 flex items-center justify-between gap-1.5 text-[10px] opacity-90'>
              <span className='truncate'>{providerLabel[anime.provider] ?? anime.provider}</span>
              {episode !== null && <span className='shrink-0 tabular-nums'>{episode}</span>}
            </div>
          </div>
        </div>
      </button>

      <div className='mt-1.5 flex items-center justify-between gap-1.5 text-[11px]'>
        {status !== undefined ? (
          <button
            type='button'
            aria-pressed={filterStatus === anime.status}
            onClick={() => onFilterStatus(filterStatus === anime.status ? undefined : anime.status)}
            className={`inline-flex items-center gap-1 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${status.className}`}
          >
            <span aria-hidden='true' className='size-[5px] rounded-full bg-current' />
            {status.label}
          </button>
        ) : (
          <span />
        )}
        <button
          type='button'
          aria-pressed={filterYear === anime.year}
          onClick={() => onFilterYear(filterYear === anime.year ? undefined : anime.year)}
          className='whitespace-nowrap rounded-sm tabular-nums text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        >
          {anime.year} {QuarterLabel[anime.quarter]}
        </button>
      </div>
    </div>
  )
}
