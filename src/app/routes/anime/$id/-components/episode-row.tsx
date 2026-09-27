import { Check } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { cn } from '@/app/lib/utils'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import { episodeStatus, formatDate, formatDuration, formatMonthDay, getWatchUrl } from '../-lib/format'
import { Artwork } from './artwork'

export type Episode = AnimeInfoSchema['seasons'][number]['episodes'][number]

/**
 * 行に出す録画状態。`episodeStatus` の 3 状態に、nagisa に送った後の進み具合
 * (`recordStatus` の pending / downloading → rec、failed / stale → fail) を重ねたもの。
 */
export type RowState = 'done' | 'todo' | 'future' | 'rec' | 'fail'

export const rowStateOf = (episode: Episode): RowState => {
  if (episode.recorded) return 'done'
  const { recordStatus } = episode
  if (recordStatus === 'pending' || recordStatus === 'downloading') return 'rec'
  if (recordStatus === 'failed' || recordStatus === 'stale') return 'fail'
  return episodeStatus(episode)
}

const rowAccent: Record<RowState, string> = {
  done: 'border-l-success',
  todo: 'border-l-border',
  future: 'border-l-transparent text-muted-foreground',
  rec: 'border-l-info',
  fail: 'border-l-destructive'
}

const markClass: Record<RowState, string> = {
  done: 'bg-success text-success-foreground',
  todo: 'border-[1.5px] border-muted-foreground',
  future: 'border-[1.5px] border-dashed border-muted-foreground',
  rec: 'animate-spin border-2 border-info/30 border-t-info',
  fail: 'border-[1.5px] border-destructive'
}

export const EpisodeRow = ({ episode, provider }: { episode: Episode; provider: string }) => {
  const content = useIntlayer('anime-id-episode-grid')
  const state = rowStateOf(episode)
  const watchUrl = getWatchUrl(provider, episode.episodeId)
  const episodeLabel = content.episodeLabel({ number: episode.episodeNumber }).value
  const title = episode.title || episodeLabel
  const stateLabel =
    state === 'rec' && episode.recordStatus === 'pending'
      ? content.state.pending.value
      : state === 'fail'
        ? (episode.recordError ?? content.recordButton.failedTitle.value)
        : state === 'done'
          ? content.recordButton.doneTitle.value
          : content.state[state].value

  return (
    <li
      id={`ep-${episode.id}`}
      className={cn(
        'grid grid-cols-[3ch_96px_minmax(0,1fr)_84px_56px_20px] items-center gap-3.5 border-b border-b-border/60 border-l-[3px] px-3 py-2 text-sm transition-colors hover:bg-muted max-sm:grid-cols-[2.5ch_68px_minmax(0,1fr)_auto] max-sm:gap-2.5 max-sm:p-2',
        rowAccent[state]
      )}
    >
      <span className='text-right text-sm font-semibold leading-[21px] text-muted-foreground tabular-nums'>
        {episode.episodeNumber}
      </span>

      <Artwork
        src={episode.imageUrl}
        alt={title}
        seed={episode.id}
        slotWidth={96}
        variant='thumb'
        className={cn('rounded-md', state === 'future' && 'opacity-55')}
      >
        {episode.hasLocalKey && (
          <span className='absolute top-1 left-1 rounded-full bg-success px-1.5 py-px text-[9.5px] font-bold text-success-foreground'>
            {content.freeBadge}
          </span>
        )}
        {episode.duration > 0 && (
          <span className='absolute right-1 bottom-1 rounded px-[5px] bg-overlay text-[10px] text-overlay-foreground tabular-nums'>
            {formatDuration(episode.duration)}
          </span>
        )}
      </Artwork>

      <div className='min-w-0'>
        <p className='truncate text-sm font-semibold leading-[21px]'>
          {watchUrl === null ? (
            title
          ) : (
            <a href={watchUrl} target='_blank' rel='noopener noreferrer' className='hover:underline'>
              {title}
            </a>
          )}
        </p>
        <div className='mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-[18px] text-muted-foreground tabular-nums'>
          <span>{episodeLabel}</span>
          <span className='hidden max-sm:inline'>{formatMonthDay(episode.releaseDate)}</span>
          {episode.hasSubtitles && (
            <StatusBadge tone='muted' variant='outline' size='sm'>
              {content.subtitlesBadge}
            </StatusBadge>
          )}
          {episode.hasDub && (
            <StatusBadge tone='muted' variant='outline' size='sm'>
              {content.dubBadge}
            </StatusBadge>
          )}
        </div>
      </div>

      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {state === 'future'
          ? content.releaseOn({ date: formatMonthDay(episode.releaseDate) }).value
          : formatDate(episode.releaseDate)}
      </span>
      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {episode.duration > 0 ? formatDuration(episode.duration) : '—'}
      </span>

      <span
        role='img'
        aria-label={stateLabel}
        title={stateLabel}
        className={cn('grid size-5 place-items-center justify-self-end rounded-full', markClass[state])}
      >
        {state === 'done' && <Check aria-hidden='true' className='size-3' strokeWidth={3} />}
      </span>
    </li>
  )
}
