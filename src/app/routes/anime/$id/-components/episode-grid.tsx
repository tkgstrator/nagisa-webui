import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
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

/**
 * 1話ぶんの録画状態トグル。`PUT /api/recordings` に繋がっている。
 * 押せるのは未録画の回だけで、未配信の回と録画済みの回は操作できない
 * (録画を削除する API がないので、録画済みからは戻せない)。
 * 押せない場合もボタン自体は同じ位置に残し、意味だけ変える。
 */
const RecordState = ({
  status,
  pending,
  onToggle
}: {
  status: EpisodeStatus
  pending: boolean
  onToggle: () => void
}) => {
  const style = pending
    ? 'border-info/40 bg-info/10 text-info'
    : status === 'done'
      ? 'cursor-default border-success/40 bg-success/10 text-success'
      : status === 'future'
        ? 'cursor-default border-dashed border-border text-muted-foreground'
        : 'border-border bg-background text-foreground hover:bg-secondary'
  const icon = pending
    ? 'animate-spin border-2 border-info/30 border-t-info'
    : status === 'done'
      ? 'bg-success text-success-foreground'
      : status === 'future'
        ? 'border-[1.5px] border-dashed border-muted-foreground'
        : 'border-[1.5px] border-muted-foreground'

  return (
    <button
      type='button'
      aria-pressed={status === 'done'}
      aria-label={status === 'done' ? '録画済み' : '録画する'}
      title={status === 'done' ? '録画済みの取り消しには対応していない' : undefined}
      disabled={status !== 'todo' || pending}
      onClick={onToggle}
      className={`inline-flex h-8 w-[104px] items-center gap-[7px] whitespace-nowrap rounded-[7px] border px-2.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${style} max-sm:w-[34px] max-sm:justify-center max-sm:px-0`}
    >
      <span className={`grid size-4 shrink-0 place-items-center rounded-full ${icon}`}>
        {status === 'done' && !pending && <Check className='size-2.5' />}
      </span>
      {pending ? (
        <span className='max-sm:sr-only'>更新中</span>
      ) : status === 'future' ? (
        <span className='max-sm:sr-only'>配信予定</span>
      ) : status === 'done' ? (
        <span className='max-sm:sr-only'>録画済み</span>
      ) : (
        <span className='max-sm:sr-only'>録画する</span>
      )}
    </button>
  )
}

const EpisodeRow = ({
  episode,
  provider,
  pending,
  onToggle
}: {
  episode: Episode
  provider: string
  pending: boolean
  onToggle: (episode: Episode) => void
}) => {
  const status = episodeStatus(episode)
  const watchUrl = getWatchUrl(provider, episode.episodeId)
  const title = episode.title || `第${episode.episodeNumber}話`

  return (
    <li
      id={`ep-${episode.id}`}
      className={`grid grid-cols-[3ch_96px_minmax(0,1fr)_84px_56px_104px] items-center gap-3.5 border-b border-b-border/60 border-l-[3px] px-3 py-2 text-sm transition-colors hover:bg-muted max-sm:grid-cols-[2.5ch_68px_minmax(0,1fr)_auto] max-sm:gap-2.5 max-sm:p-2 ${rowAccent[status]}`}
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
        className={`rounded-md ${status === 'future' ? 'opacity-55' : ''}`}
      >
        {episode.hasLocalKey && (
          <span className='absolute top-1 left-1 rounded-full bg-success px-1.5 py-px text-[9.5px] font-bold text-success-foreground'>
            無料
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
              字幕
            </span>
          )}
          {episode.hasDub && (
            <span className='inline-flex h-4 items-center rounded border border-border px-[5px] text-[10.5px] leading-none'>
              吹替
            </span>
          )}
        </div>
      </div>

      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {status === 'future' ? `${formatMonthDay(episode.releaseDate)} 配信` : formatDate(episode.releaseDate)}
      </span>
      <span className='text-right text-[13px] leading-[19.5px] text-muted-foreground tabular-nums max-sm:hidden'>
        {episode.duration > 0 ? formatDuration(episode.duration) : '—'}
      </span>

      <RecordState status={status} pending={pending} onToggle={() => onToggle(episode)} />
    </li>
  )
}

export function EpisodeGrid({ anime }: { anime: AnimeInfoSchema }) {
  const seasons = anime.seasons
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '')
  const [filter, setFilter] = useState<Filter>('all')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const queryClient = useQueryClient()

  const season = seasons.find((item) => item.id === activeSeasonId) ?? seasons[0]

  /** `episodeId` はバックエンドが `where: { id }` で引くので DB 行の id を渡す。 */
  const updateRecording = useMutation({
    mutationFn: ({ episodeId, recorded }: { episodeId: string; recorded: boolean }) =>
      api.updateRecording({ episodeId, recorded }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.anime.all }),
    onError: () => toast.error('録画状態の更新に失敗しました')
  })

  /** 録画済みから戻す手段がない (録画を削除する API がない) ので、録画する方向にしか動かさない。 */
  const markRecorded = (episode: Episode) => {
    updateRecording.mutate({ episodeId: episode.id, recorded: true })
  }

  const pendingEpisodeId = updateRecording.isPending ? (updateRecording.variables?.episodeId ?? null) : null

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

  if (season === undefined) {
    return (
      <section aria-labelledby='ep-heading'>
        <div className='mb-3.5 flex flex-wrap items-baseline justify-between gap-3'>
          <h2 id='ep-heading' className='text-base font-bold'>
            エピソード
          </h2>
        </div>
        <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>
          エピソード情報はまだありません
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
      <div className='mb-3.5 flex flex-wrap items-baseline justify-between gap-3'>
        <h2 id='ep-heading' className='text-base font-bold'>
          エピソード
        </h2>
        <span className='text-xs leading-[18px] text-muted-foreground tabular-nums'>
          {season.displayName} · 全 {season.episodes.length} 話
        </span>
      </div>

      <div
        className='flex gap-0.5 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]'
        role='tablist'
        aria-label='シーズン'
      >
        {seasons.map((item) => (
          <button
            key={item.id}
            type='button'
            role='tab'
            aria-selected={item.id === season.id}
            onClick={() => setActiveSeasonId(item.id)}
            className='inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm leading-[21px] text-muted-foreground transition-colors aria-selected:border-b-primary aria-selected:font-semibold aria-selected:text-foreground'
          >
            {item.displayName}
            <span className='text-xs leading-[18px] text-muted-foreground tabular-nums'>{item.episodes.length}</span>
          </button>
        ))}
        <span className='flex-1' />
        <span className='self-center whitespace-nowrap px-1 text-xs leading-[18px] text-muted-foreground max-sm:hidden'>
          {anime.scheduled ? '新着エピソードを自動録画' : '自動録画は無効'}
        </span>
      </div>

      <section
        className='mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 rounded-r-lg border-l-[3px] border-l-primary bg-muted/60 px-4 py-3.5 max-sm:grid-cols-[minmax(0,1fr)]'
        aria-label='録画状況'
      >
        <div>
          <div className='flex h-3.5 gap-[3px]'>
            {season.episodes.map((episode) => (
              <a
                key={episode.id}
                href={`#ep-${episode.id}`}
                title={`第${episode.episodeNumber}話`}
                className={`min-w-0 flex-1 rounded-[3px] ${stripColor[episodeStatus(episode)]}`}
              >
                <span className='sr-only'>第{episode.episodeNumber}話</span>
              </a>
            ))}
          </div>
          <div className='mt-[18px] flex justify-between text-[11px] text-muted-foreground tabular-nums'>
            <span>第{first}話</span>
            {middle !== null && <span>第{middle}話</span>}
            <span>第{last}話</span>
          </div>
        </div>
        <div className='grid grid-cols-3 gap-x-[18px] max-sm:col-start-1'>
          <Stat label='録画済み' value={stats.done} dot='bg-success' />
          <Stat label='未録画' value={stats.todo} dot='bg-muted-foreground/45' />
          <Stat label='配信予定' value={stats.future} dot='bg-border' />
        </div>
      </section>

      <fieldset className='mb-3 flex flex-wrap gap-1.5 border-0 p-0' aria-label='絞り込み'>
        <button type='button' aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chipClass}>
          すべて <span className='opacity-80 tabular-nums'>{season.episodes.length}</span>
        </button>
        <button type='button' aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')} className={chipClass}>
          未録画 <span className='opacity-80 tabular-nums'>{stats.todo}</span>
        </button>
        <button type='button' aria-pressed={filter === 'free'} onClick={() => setFilter('free')} className={chipClass}>
          無料 <span className='opacity-80 tabular-nums'>{stats.free}</span>
        </button>
        <span className='flex-1' />
        <button
          type='button'
          onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
          className={`${chipClass} border-transparent`}
        >
          話数順 {order === 'asc' ? '↑' : '↓'}
        </button>
      </fieldset>

      <ol>
        {visible.map((episode) => (
          <EpisodeRow
            key={episode.id}
            episode={episode}
            provider={anime.provider}
            pending={pendingEpisodeId === episode.id}
            onToggle={markRecorded}
          />
        ))}
      </ol>

      <div className='flex items-center justify-between px-3 pt-3 text-xs leading-[18px] text-muted-foreground'>
        <span className='tabular-nums'>
          録画済み {stats.done} 話{stats.duration > 0 && ` · ${formatRuntime(stats.duration)}`}
        </span>
        <Link to='/recordings' className='inline-flex items-center gap-1 font-semibold text-primary'>
          録画一覧で開く
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
