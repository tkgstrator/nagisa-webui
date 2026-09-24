import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import { Checkbox } from '@/app/components/ui/checkbox'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import {
  type EpisodeStatus,
  episodeStatus,
  formatDate,
  formatDuration,
  formatMonthDay,
  formatRuntime,
  getWatchUrl
} from '../-lib/format'
import { Artwork } from './artwork'

type Episode = AnimeInfoSchema['seasons'][number]['episodes'][number]
type Filter = 'all' | 'todo' | 'free'

const stripColor: Record<EpisodeStatus, string> = {
  done: 'bg-success',
  todo: 'bg-muted-foreground/45',
  future: 'border border-dashed border-border'
}

const rowAccent: Record<EpisodeStatus, string> = {
  done: 'border-l-success',
  todo: 'border-l-border',
  future: 'border-l-transparent text-muted-foreground'
}

const chipClass =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground'

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
 * 1話ぶんの録画ボタン。`POST /api/anime/:id/record` に話を 1 つだけ渡して nagisa に送る。
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

const EpisodeRow = ({
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

export function EpisodeGrid({ anime }: { anime: AnimeInfoSchema }) {
  const content = useIntlayer('anime-id-episode-grid')
  const seasons = anime.seasons
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const queryClient = useQueryClient()

  const season = seasons.find((item) => item.id === activeSeasonId) ?? seasons[0]

  /** 録画は nagisa に送るだけ。実際に録れたかは refresh の同期で録画済みに変わる。 */
  const record = useMutation({
    mutationFn: (episodeIds: string[]) => api.recordAnime({ episodeIds }, { params: { id: anime.id } }),
    onSuccess: (data, episodeIds) => {
      toast.success(content.recordToast.success({ count: episodeIds.length }).value, {
        description:
          data.count === episodeIds.length ? undefined : content.recordToast.acceptedCount({ count: data.count }).value
      })
      setSelectedIds(new Set())
    },
    onError: () => toast.error(content.recordToast.error.value),
    // 失敗したときもサーバー側は録画イベントと失敗状態を書いているので、どちらでも読み直す
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.nagisa.syncState })
    }
  })

  const sendingIds: ReadonlySet<string> = new Set(record.isPending ? record.variables : [])

  const selectEpisode = (episode: Episode, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (selected) next.add(episode.id)
      else next.delete(episode.id)
      return next
    })
  }

  const stats = useMemo(() => {
    const episodes = season?.episodes ?? []
    return {
      done: episodes.filter((episode) => episodeStatus(episode) === 'done').length,
      todo: episodes.filter((episode) => episodeStatus(episode) === 'todo').length,
      future: episodes.filter((episode) => episodeStatus(episode) === 'future').length,
      free: episodes.filter((episode) => episode.hasLocalKey).length,
      duration: episodes.reduce((sum, episode) => (episode.recorded ? sum + episode.duration : sum), 0)
    }
  }, [season])

  const visible = useMemo(() => {
    const episodes = [...(season?.episodes ?? [])]
      .filter((episode) => {
        if (filter === 'todo') return episodeStatus(episode) === 'todo'
        if (filter === 'free') return episode.hasLocalKey
        return true
      })
      .sort((a, b) => a.episodeNumber - b.episodeNumber)
    return order === 'asc' ? episodes : episodes.reverse()
  }, [season, filter, order])

  /** 選択は表示中のシーズンの話だけを数える (タブを切り替えた先に古い選択を持ち越さない)。 */
  const selectable = visible.filter((episode) => episodeStatus(episode) !== 'future')
  const selected = (season?.episodes ?? []).filter((episode) => selectedIds.has(episode.id))
  const allSelected = selectable.length > 0 && selectable.every((episode) => selectedIds.has(episode.id))

  const selectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectable.map((episode) => episode.id)) : new Set())
  }

  if (season === undefined) {
    return (
      <section aria-labelledby='ep-heading'>
        <h2 id='ep-heading' className='mb-3.5 text-base font-bold'>
          {content.heading}
        </h2>
        <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>
          {content.noEpisodes}
        </p>
      </section>
    )
  }

  const numbers = season.episodes.map((episode) => episode.episodeNumber)
  const sorted = [...numbers].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  /** ストリップ中央に対応する話数。両端と重なる短いシーズンでは出さない。 */
  const middle = sorted.length >= 5 ? sorted[Math.floor((sorted.length - 1) / 2)] : null

  return (
    <section aria-labelledby='ep-heading'>
      {/* シーズン名と話数はすぐ下のタブが出すので、見出しでは繰り返さない。 */}
      <h2 id='ep-heading' className='mb-3.5 text-base font-bold'>
        {content.heading}
      </h2>

      <div
        className='flex gap-0.5 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]'
        role='tablist'
        aria-label={content.seasonTabsLabel.value}
      >
        {seasons.map((item) => (
          <button
            key={item.id}
            type='button'
            role='tab'
            aria-selected={item.id === season.id}
            onClick={() => {
              setActiveSeasonId(item.id)
              setSelectedIds(new Set())
            }}
            className='inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm leading-[21px] text-muted-foreground transition-colors aria-selected:border-b-primary aria-selected:font-semibold aria-selected:text-foreground'
          >
            {item.displayName}
            <span className='text-xs leading-[18px] text-muted-foreground tabular-nums'>{item.episodes.length}</span>
          </button>
        ))}
        <span className='flex-1' />
        <span className='self-center whitespace-nowrap px-1 text-xs leading-[18px] text-muted-foreground max-sm:hidden'>
          {anime.scheduled ? content.autoRecordOn : content.autoRecordOff}
        </span>
      </div>

      <section
        className='mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 rounded-r-lg border-l-[3px] border-l-primary bg-muted/60 px-4 py-3.5 max-sm:grid-cols-[minmax(0,1fr)]'
        aria-label={content.recordingStatusLabel.value}
      >
        <div>
          <div className='flex h-3.5 gap-[3px]'>
            {season.episodes.map((episode) => (
              <a
                key={episode.id}
                href={`#ep-${episode.id}`}
                title={content.episodeLabel({ number: episode.episodeNumber }).value}
                className={`min-w-0 flex-1 rounded-[3px] ${stripColor[episodeStatus(episode)]}`}
              >
                <span className='sr-only'>{content.episodeLabel({ number: episode.episodeNumber })}</span>
              </a>
            ))}
          </div>
          <div className='mt-[18px] flex justify-between text-[11px] text-muted-foreground tabular-nums'>
            <span>{content.episodeLabel({ number: first })}</span>
            {middle !== null && <span>{content.episodeLabel({ number: middle })}</span>}
            <span>{content.episodeLabel({ number: last })}</span>
          </div>
        </div>
        <div className='grid grid-cols-3 gap-x-[18px] max-sm:col-start-1'>
          <Stat label={content.stats.done.value} value={stats.done} dot='bg-success' />
          <Stat label={content.stats.todo.value} value={stats.todo} dot='bg-muted-foreground/45' />
          <Stat label={content.stats.future.value} value={stats.future} dot='bg-border' />
        </div>
      </section>

      <fieldset
        className='mb-3 flex flex-wrap items-center gap-1.5 border-0 p-0'
        aria-label={content.filterFieldsetLabel.value}
      >
        <span className='inline-flex h-7 items-center gap-2 pr-1.5 pl-[15px] text-[12.5px] text-muted-foreground max-sm:pl-[11px]'>
          <Checkbox
            aria-label={content.selectAllLabel.value}
            checked={allSelected}
            disabled={selectable.length === 0}
            onCheckedChange={selectAll}
          />
        </span>
        <button type='button' aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chipClass}>
          {content.filterChips.all} <span className='opacity-80 tabular-nums'>{season.episodes.length}</span>
        </button>
        <button type='button' aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')} className={chipClass}>
          {content.filterChips.todo} <span className='opacity-80 tabular-nums'>{stats.todo}</span>
        </button>
        <button type='button' aria-pressed={filter === 'free'} onClick={() => setFilter('free')} className={chipClass}>
          {content.filterChips.free} <span className='opacity-80 tabular-nums'>{stats.free}</span>
        </button>
        <span className='flex-1' />
        <button
          type='button'
          disabled={selected.length === 0 || record.isPending}
          onClick={() => record.mutate(selected.map((episode) => episode.id))}
          className={`${chipClass} border-primary/40 font-semibold text-primary enabled:hover:bg-primary/10 disabled:cursor-default disabled:border-border disabled:font-normal disabled:text-muted-foreground disabled:hover:bg-transparent`}
        >
          {content.recordSelected} <span className='opacity-80 tabular-nums'>{selected.length}</span>
        </button>
        <button
          type='button'
          onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
          className={`${chipClass} border-transparent`}
        >
          {content.orderButton} {order === 'asc' ? '↑' : '↓'}
        </button>
      </fieldset>

      <ol>
        {visible.map((episode) => (
          <EpisodeRow
            key={episode.id}
            episode={episode}
            provider={anime.provider}
            sending={sendingIds.has(episode.id)}
            selected={selectedIds.has(episode.id)}
            onSelect={selectEpisode}
            onRecord={(episodeIds) => record.mutate(episodeIds)}
          />
        ))}
      </ol>

      <div className='flex items-center justify-between px-3 pt-3 text-xs leading-[18px] text-muted-foreground'>
        <span className='tabular-nums'>
          {content.footerRecorded({ count: stats.done })}
          {stats.duration > 0 && ` · ${formatRuntime(stats.duration)}`}
        </span>
        <Link to='/recordings' className='inline-flex items-center gap-1 font-semibold text-primary'>
          {content.openRecordings}
          <ChevronRight className='size-3' />
        </Link>
      </div>
    </section>
  )
}

const Stat = ({ label, value, dot }: { label: string; value: number; dot: string }) => (
  <div className='flex flex-col items-end'>
    <span className='flex items-center gap-[5px] whitespace-nowrap text-[11px] text-muted-foreground'>
      <span aria-hidden='true' className={`size-2 rounded-[2px] ${dot}`} />
      {label}
    </span>
    <span className='text-xl font-bold leading-[1.2] tabular-nums'>{value}</span>
  </div>
)
