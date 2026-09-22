import { Link } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { Check, Circle, RefreshCw } from 'lucide-react'
import { browseFiltersAtom, browseFiltersDefaults } from '@/app/lib/atoms'
import { providerColor, providerLabel, statusColor, statusLabel } from '@/app/lib/constants'
import { type AnimeInfoSchema, QuarterLabel } from '@/schemas/anime.dto'
import { formatRuntime } from '../-lib/format'
import { Artwork } from './artwork'

const badgeClass = 'inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-semibold'

const btnClass =
  'inline-flex h-[34px] items-center justify-center gap-[7px] rounded-full border border-border px-[15px] text-[13px] font-semibold transition-colors hover:bg-muted disabled:pointer-events-none max-sm:flex-auto'

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className='flex flex-col gap-0.5'>
    <dt className='text-[11px] text-muted-foreground'>{label}</dt>
    <dd className='m-0 text-[13.5px] font-semibold tabular-nums'>{value}</dd>
  </div>
)

export function AnimeHero({
  anime,
  totalEpisodes,
  totalDuration,
  updating,
  refreshing,
  onToggleScheduled,
  onToggleRecorded,
  onRefresh
}: {
  anime: AnimeInfoSchema
  totalEpisodes: number
  totalDuration: number
  updating: boolean
  refreshing: boolean
  onToggleScheduled: () => void
  onToggleRecorded: () => void
  onRefresh: () => void
}) {
  const setFilters = useSetAtom(browseFiltersAtom)
  const recordedCount = anime.seasons.reduce(
    (sum, season) => sum + season.episodes.filter((episode) => episode.recorded).length,
    0
  )

  return (
    <div className='flex items-start gap-7 max-sm:flex-col max-sm:gap-3.5'>
      <Artwork
        src={anime.imageUrl}
        alt={anime.title}
        seed={anime.id}
        slotWidth={400}
        variant='hero'
        initial={anime.title.slice(0, 1)}
        className='w-[400px] max-w-full shrink-0 rounded-[14px] shadow-[0_20px_40px_-18px_oklch(0.15_0.02_265/40%)] max-sm:w-full'
      />

      <div className='min-w-0 flex-auto'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className={`${badgeClass} ${providerColor[anime.provider]}`}>{providerLabel[anime.provider]}</span>
          <span className={`${badgeClass} ${statusColor[anime.status]}`}>
            {anime.status === 'RELEASING' && <span aria-hidden='true' className='size-[5px] rounded-full bg-current' />}
            {statusLabel[anime.status]}
          </span>
          {anime.entityType === 'movie' && (
            <span className={`${badgeClass} bg-secondary text-secondary-foreground`}>映画</span>
          )}
        </div>

        <h1 className='mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] max-sm:text-[21px]'>
          <Link
            to='/browse'
            onClick={() => setFilters({ ...browseFiltersDefaults(), aniListId: anime.aniListId })}
            className='transition-colors hover:text-primary'
          >
            {anime.title}
          </Link>
        </h1>

        <div className='mt-[22px]'>
          <dl className='m-0 flex flex-wrap gap-[22px] max-sm:gap-4'>
            <Fact label='放送' value={anime.year > 0 ? `${anime.year}年 ${QuarterLabel[anime.quarter]}` : '不明'} />
            <Fact label='話数' value={`${totalEpisodes}話`} />
            <Fact
              label='1話あたり'
              value={totalEpisodes > 0 ? `約${formatRuntime(Math.round(totalDuration / totalEpisodes))}` : '—'}
            />
            <Fact label='総再生時間' value={totalDuration > 0 ? formatRuntime(totalDuration) : '—'} />
          </dl>

          {anime.description && (
            <p className='mt-3.5 max-w-[680px] text-[13px] leading-[1.7] text-muted-foreground'>{anime.description}</p>
          )}

          <div className='mt-[18px] flex flex-wrap items-center gap-2.5'>
            <button
              type='button'
              onClick={onToggleScheduled}
              disabled={updating}
              aria-pressed={anime.scheduled}
              className={`${btnClass} ${anime.scheduled ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            >
              {anime.scheduled ? <Check className='size-[15px]' /> : <Circle className='size-[15px]' />}
              {anime.scheduled ? '録画予約中' : '録画を予約'}
            </button>
            {/* 録画を取り消す API がないので、録画済みになったら押せない。位置と見た目は保ったまま意味だけ変える。 */}
            <button
              type='button'
              onClick={onToggleRecorded}
              disabled={updating || anime.recorded}
              aria-pressed={anime.recorded}
              title={anime.recorded ? '録画済みの取り消しには対応していない' : undefined}
              className={`${btnClass} ${anime.recorded ? 'border-transparent bg-success text-success-foreground' : ''}`}
            >
              {anime.recorded ? <Check className='size-[15px]' /> : <Circle className='size-[15px]' />}
              {anime.recorded ? `録画済み (${recordedCount}話)` : '今すぐ録画'}
            </button>
            <button type='button' onClick={onRefresh} disabled={updating} className={btnClass}>
              <RefreshCw className={`size-[15px] ${refreshing ? 'animate-spin' : ''}`} />
              再取得
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
