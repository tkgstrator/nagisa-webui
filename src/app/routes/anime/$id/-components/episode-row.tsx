import { Check } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { Checkbox } from '@/app/components/ui/checkbox'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import {
  type EpisodeStatus,
  episodeStatus,
  formatDate,
  formatDuration,
  formatMonthDay,
  getWatchUrl
} from '../-lib/format'
import { Artwork } from './artwork'

export type Episode = AnimeInfoSchema['seasons'][number]['episodes'][number]

const rowAccent: Record<EpisodeStatus, string> = {
  done: 'border-l-success',
  todo: 'border-l-border',
  future: 'border-l-transparent text-muted-foreground'
}

/** nagisa に送った後の進み具合。`recordStatus` が none / completed / missing のときは録画済みフラグ側で見せる。 */
type Progress = 'pending' | 'downloading' | 'failed' | null

const progressOf = (episode: Episode): Progress => {
  if (episode.recorded) return null
  const { recordStatus } = episode
  if (recordStatus === 'pending' || recordStatus === 'downloading') return recordStatus
  if (recordStatus === 'failed' || recordStatus === 'stale') return 'failed'
  return null
}

/**
 * 1話ぶんの録画ボタン。`POST /api/anime/:id/recording-jobs` に話を 1 つだけ渡して nagisa に送る。
 * 録画済みの回も押せる (nagisa 側が既にあるファイルを飛ばすので重複しても害はない)。
 * 押せないのは未配信の回と送信中だけ。押せない場合もボタン自体は同じ位置に残し、意味だけ変える。
 */
const RecordState = ({
  status,
  progress,
  error,
  sending,
  onRecord
}: {
  status: EpisodeStatus
  progress: Progress
  error: string | null
  sending: boolean
  onRecord: () => void
}) => {
  const content = useIntlayer('anime-id-episode-grid')
  const busy = sending || progress === 'pending' || progress === 'downloading'
  const style = busy
    ? 'border-info/40 bg-info/10 text-info'
    : status === 'done'
      ? 'border-success/40 bg-success/10 text-success hover:bg-success/15'
      : status === 'future'
        ? 'cursor-default border-dashed border-border text-muted-foreground'
        : progress === 'failed'
          ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
          : 'border-border bg-background text-foreground hover:bg-secondary'
  const icon = busy
    ? 'animate-spin border-2 border-info/30 border-t-info'
    : status === 'done'
      ? 'bg-success text-success-foreground'
      : status === 'future'
        ? 'border-[1.5px] border-dashed border-muted-foreground'
        : progress === 'failed'
          ? 'border-[1.5px] border-destructive'
          : 'border-[1.5px] border-muted-foreground'
  const label = sending
    ? content.recordButton.sending.value
    : progress === 'pending'
      ? content.recordButton.pending.value
      : progress === 'downloading'
        ? content.recordButton.downloading.value
        : status === 'future'
          ? content.recordButton.future.value
          : status === 'done'
            ? content.recordButton.done.value
            : progress === 'failed'
              ? content.recordButton.retry.value
              : content.recordButton.record.value
  const title =
    progress === 'failed'
      ? (error ?? content.recordButton.failedTitle.value)
      : status === 'done'
        ? content.recordButton.doneTitle.value
        : undefined

  return (
    <button
      type='button'
      aria-label={label}
      title={title}
      disabled={status === 'future' || sending}
      onClick={onRecord}
      className={`inline-flex h-8 w-[104px] items-center justify-center gap-[7px] whitespace-nowrap rounded-[7px] border px-2.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${style} max-sm:w-[34px] max-sm:px-0`}
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded-full ${icon}`}>
        {status === 'done' && !busy && <Check className='size-2.5' />}
      </span>
      <span className='max-sm:sr-only'>{label}</span>
    </button>
  )
}

export const EpisodeRow = ({
  episode,
  provider,
  sending,
  selected,
  onSelect,
  onRecord
}: {
  episode: Episode
  provider: string
  sending: boolean
  selected: boolean
  onSelect: (episode: Episode, selected: boolean) => void
  onRecord: (episodeIds: string[]) => void
}) => {
  const content = useIntlayer('anime-id-episode-grid')
  const status = episodeStatus(episode)
  const progress = progressOf(episode)
  const watchUrl = getWatchUrl(provider, episode.episodeId)
  const title = episode.title || content.episodeLabel({ number: episode.episodeNumber }).value

  return (
    <li
      id={`ep-${episode.id}`}
      className={`grid grid-cols-[16px_3ch_96px_minmax(0,1fr)_84px_56px_104px] items-center gap-3.5 border-b border-b-border/60 border-l-[3px] p-3 text-sm transition-colors hover:bg-muted max-sm:grid-cols-[16px_2.5ch_68px_minmax(0,1fr)_auto] max-sm:gap-2.5 max-sm:p-2 ${progress === 'failed' ? 'border-l-destructive' : rowAccent[status]}`}
    >
      <Checkbox
        aria-label={content.selectEpisodeLabel({ number: episode.episodeNumber }).value}
        checked={selected}
        disabled={status === 'future'}
        onCheckedChange={(checked) => onSelect(episode, checked)}
      />
      <span className='text-right text-sm font-semibold leading-[21px] text-muted-foreground tabular-nums'>
        {episode.episodeNumber}
      </span>

      <Artwork
        src={episode.imageUrl}
        alt={title}
        seed={episode.id}
        slotWidth={96}
        variant='thumb'
        className={`rounded-md ${status === 'future' ? 'opacity-55' : ''}`}
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
          <span className='hidden max-sm:inline'>{formatMonthDay(episode.releaseDate)}</span>
          {episode.hasSubtitles && (
            <span className='inline-flex h-4 items-center rounded border border-border px-[5px] text-[10.5px] leading-none'>
              {content.subtitlesBadge}
            </span>
          )}
          {episode.hasDub && (
            <span className='inline-flex h-4 items-center rounded border border-border px-[5px] text-[10.5px] leading-none'>
              {content.dubBadge}
            </span>
          )}
        </div>
      </div>

      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {status === 'future'
          ? content.releaseOn({ date: formatMonthDay(episode.releaseDate) }).value
          : formatDate(episode.releaseDate)}
      </span>
      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {episode.duration > 0 ? formatDuration(episode.duration) : '—'}
      </span>

      <RecordState
        status={status}
        progress={progress}
        error={episode.recordError}
        sending={sending}
        onRecord={() => onRecord([episode.id])}
      />
    </li>
  )
}
