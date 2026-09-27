import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Chip } from '@/app/components/ui/chip'
import { SectionHeading } from '@/app/components/ui/section-heading'
import { StatusDot } from '@/app/components/ui/status-dot'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import { cn } from '@/app/lib/utils'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import { episodeStatus, formatRuntime } from '../-lib/format'
import { type Episode, EpisodeRow, type RowState, rowStateOf } from './episode-row'

type Filter = 'all' | 'todo' | 'free'

const stripColor: Record<RowState, string> = {
  done: 'bg-success',
  todo: 'bg-muted-foreground/45',
  future: 'border border-dashed border-border',
  rec: 'bg-info',
  fail: 'bg-destructive'
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.recordingLibrary.syncState })
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

  /** 選択は表示中のシーズンの話だけを数える。 */
  const selectable = visible.filter((episode) => episodeStatus(episode) !== 'future')
  const selected = (season?.episodes ?? []).filter((episode) => selectedIds.has(episode.id))
  const allSelected = selectable.length > 0 && selectable.every((episode) => selectedIds.has(episode.id))

  const selectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectable.map((episode) => episode.id)) : new Set())
  }

  if (season === undefined) {
    return (
      <section aria-labelledby='ep-heading'>
        <SectionHeading compact appearance='plain' className='mb-3.5'>
          <h2 id='ep-heading'>{content.heading}</h2>
        </SectionHeading>
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
      <SectionHeading compact appearance='plain' className='mb-3.5'>
        <h2 id='ep-heading'>{content.heading}</h2>
      </SectionHeading>

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
                className={cn('min-w-0 flex-1 rounded-[3px]', stripColor[rowStateOf(episode)])}
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
        <div className='grid grid-flow-col gap-x-[18px] max-sm:col-start-1'>
          <Stat label={content.stats.total.value} value={season.episodes.length} tone='muted' />
          <Stat label={content.stats.done.value} value={stats.done} tone='success' />
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
        <Chip type='button' aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {content.filterChips.all} <span className='opacity-80 tabular-nums'>{season.episodes.length}</span>
        </Chip>
        <Chip type='button' aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')}>
          {content.filterChips.todo} <span className='opacity-80 tabular-nums'>{stats.todo}</span>
        </Chip>
        <Chip type='button' aria-pressed={filter === 'free'} onClick={() => setFilter('free')}>
          {content.filterChips.free} <span className='opacity-80 tabular-nums'>{stats.free}</span>
        </Chip>
        <span className='flex-1' />
        <Chip
          type='button'
          tone='primary'
          disabled={selected.length === 0 || record.isPending}
          onClick={() => record.mutate(selected.map((episode) => episode.id))}
          className='border-primary/40 font-semibold text-primary enabled:hover:bg-primary/10 disabled:cursor-default disabled:border-border disabled:font-normal disabled:text-muted-foreground disabled:hover:bg-transparent'
        >
          {content.recordSelected} <span className='opacity-80 tabular-nums'>{selected.length}</span>
        </Chip>
        <Chip type='button' tone='primary' onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}>
          {content.orderButton} {order === 'asc' ? '↑' : '↓'}
        </Chip>
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

const Stat = ({ label, value, tone }: { label: string; value: number; tone: 'muted' | 'success' }) => (
  <div className='flex flex-col items-end'>
    <span className='flex items-center gap-[5px] whitespace-nowrap text-[11px] text-muted-foreground'>
      <StatusDot aria-hidden='true' tone={tone} size='lg' />
      {label}
    </span>
    <span className='text-xl font-bold leading-[1.2] tabular-nums'>{value}</span>
  </div>
)
