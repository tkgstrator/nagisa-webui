import { Link } from '@tanstack/react-router'
import { useSetAtom } from 'jotai'
import { Check, Circle, RotateCw, Send } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { Button } from '@/app/components/ui/button'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { StatusDot } from '@/app/components/ui/status-dot'
import { browseFiltersAtom, browseFiltersDefaults } from '@/app/lib/atoms'
import { providerColor, providerLabel, statusColor, statusLabel } from '@/app/lib/constants'
import { cn } from '@/app/lib/utils'
import { type AnimeInfoSchema, QuarterLabel } from '@/schemas/anime.dto'
import { formatRuntime } from '../-lib/format'
import { Artwork } from './artwork'

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
  const content = useIntlayer('anime-id-anime-hero')
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
          <StatusBadge
            className={cn('h-auto border-0 px-[9px] py-[3px] text-[11px]', providerColor[anime.provider])}
            size='sm'
          >
            {providerLabel[anime.provider]}
          </StatusBadge>
          <StatusBadge
            className={cn('h-auto border-0 px-[9px] py-[3px] text-[11px]', statusColor[anime.status])}
            size='sm'
          >
            {anime.status === 'RELEASING' && <StatusDot aria-hidden='true' size='sm' className='bg-current' />}
            {statusLabel[anime.status]}
          </StatusBadge>
          {anime.entityType === 'movie' && (
            <StatusBadge
              className='h-auto border-0 bg-secondary px-[9px] py-[3px] text-[11px] text-secondary-foreground'
              size='sm'
            >
              {content.movieBadge}
            </StatusBadge>
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
            <Fact
              label={content.facts.broadcast.value}
              value={
                anime.year > 0
                  ? content.facts.broadcastYear({ year: anime.year, quarter: QuarterLabel[anime.quarter] }).value
                  : content.facts.unknown.value
              }
            />
            <Fact
              label={content.facts.episodeCount.value}
              value={content.facts.episodeCountValue({ count: totalEpisodes }).value}
            />
            <Fact
              label={content.facts.perEpisode.value}
              value={
                totalEpisodes > 0
                  ? content.facts.perEpisodeValue({
                      duration: formatRuntime(Math.round(totalDuration / totalEpisodes))
                    }).value
                  : '—'
              }
            />
            <Fact
              label={content.facts.totalDuration.value}
              value={totalDuration > 0 ? formatRuntime(totalDuration) : '—'}
            />
          </dl>

          {anime.description && (
            <p className='mt-3.5 max-w-[680px] text-[13px] leading-[1.7] text-muted-foreground'>{anime.description}</p>
          )}

          <div className='mt-[18px] flex flex-wrap items-center gap-2.5'>
            <Button
              type='button'
              variant={anime.scheduled ? 'default' : 'outline'}
              size='pill'
              className='h-[34px] px-[15px] max-sm:flex-auto'
              onClick={onToggleScheduled}
              disabled={updating}
              aria-pressed={anime.scheduled}
            >
              {anime.scheduled ? <Check className='size-[14px]' /> : <Circle className='size-[14px]' />}
              {anime.scheduled ? content.scheduleButton.scheduled : content.scheduleButton.schedule}
            </Button>
            {/* 録画を取り消す API がないので、録画済みになったら押せない。位置と見た目は保ったまま意味だけ変える。 */}
            <Button
              type='button'
              variant={anime.recorded ? 'success' : 'outline'}
              size='pill'
              className='h-[34px] px-[15px] max-sm:flex-auto'
              onClick={onToggleRecorded}
              disabled={updating || anime.recorded}
              aria-pressed={anime.recorded}
              title={
                anime.recorded ? content.recordButton.recordedTitle.value : content.recordButton.recordNowTitle.value
              }
            >
              {anime.recorded ? <Check className='size-[14px]' /> : <Send className='size-[14px]' />}
              {anime.recorded
                ? content.recordButton.recorded({ count: recordedCount })
                : content.recordButton.recordNow}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='pill'
              className='h-[34px] px-[15px] max-sm:flex-auto'
              onClick={onRefresh}
              disabled={updating}
            >
              <RotateCw className={cn('size-[14px]', refreshing && 'animate-spin')} />
              {content.refreshButton}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
