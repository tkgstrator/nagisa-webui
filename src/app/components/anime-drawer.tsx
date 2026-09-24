import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Circle, CircleCheck, ExternalLink, RefreshCw } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import { ProviderBadge, StatusBadge } from '@/app/components/anime-badges'
import { ProxyImage } from '@/app/components/proxy-image'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import api from '@/app/lib/api'
import { providerLabel } from '@/app/lib/constants'
import { queryKeys } from '@/app/lib/query-keys'
import { animeDetailQueryOptions } from '@/app/lib/query-options'
import { QuarterLabel } from '@/schemas/anime.dto'

type AnimeDrawerProps = {
  animeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EPISODE_PREVIEW_LIMIT = 5

function getProviderTitleUrl(provider: string, contentId: string): string | null {
  if (!contentId) return null
  switch (provider) {
    case 'amazon':
      return `https://www.amazon.co.jp/gp/video/detail/${contentId}`
    case 'hulu':
      return `https://www.hulu.jp/${contentId}`
    case 'crunchyroll':
      return `https://www.crunchyroll.com/series/${contentId}`
    case 'abema':
      return `https://abema.tv/video/title/${contentId}`
    case 'netflix':
      return `https://www.netflix.com/title/${contentId}`
    default:
      return null
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: unknown } }).response
    const data = response?.data
    if (data && typeof data === 'object') {
      const message = (data as { error?: unknown }).error
      if (typeof message === 'string' && message.trim().length > 0) return message
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message
  return fallback
}

export function AnimeDrawer({ animeId, open, onOpenChange }: AnimeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='flex w-full flex-col gap-0 sm:max-w-md'>
        {animeId ? <AnimeDrawerBody animeId={animeId} onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function AnimeDrawerBody({ animeId, onClose }: { animeId: string; onClose: () => void }) {
  const content = useIntlayer('anime-drawer')
  const queryClient = useQueryClient()
  const { data: anime, isLoading } = useQuery(animeDetailQueryOptions(animeId))

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.anime.detail(animeId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
  }

  const updateAnimeMutation = useMutation({
    mutationFn: (body: { scheduled?: boolean; recorded?: boolean }) =>
      api.updateAnime(body, { params: { id: animeId } }),
    onSuccess: invalidateRelated
  })

  const recordAnimeMutation = useMutation({
    mutationFn: () => api.recordAnime(undefined, { params: { id: animeId } }),
    onSuccess: (data) => {
      if (data.count === 0) {
        toast.info(content.toasts.recordNoEpisodes.value)
        return
      }
      toast.success(content.toasts.recordStarted.value)
    },
    onError: () => toast.error(content.toasts.recordFailed.value),
    // 失敗しても各話の録画状態は書き換わっているので読み直す
    onSettled: invalidateRelated
  })

  const refreshAnimeMutation = useMutation({
    mutationFn: () => api.refreshAnime(undefined, { params: { id: animeId } }),
    onSuccess: (data) => {
      // 配信元の更新は済んでいる。nagisa との同期だけが落ちた場合は、そうと分かるように出す
      if (data.sync.jobs.error !== null || data.sync.library.error !== null) {
        toast.warning(content.toasts.refreshPartialFailure.value, {
          description: data.sync.jobs.error ?? data.sync.library.error ?? undefined
        })
      } else {
        toast.success(content.toasts.refreshSuccess.value)
      }
      invalidateRelated()
      queryClient.invalidateQueries({ queryKey: queryKeys.nagisa.syncState })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, content.toasts.refreshFailedFallback.value))
  })

  if (isLoading || !anime) {
    return (
      <div className='flex flex-1 items-center justify-center p-8'>
        <p className='text-sm text-muted-foreground'>{content.loading}</p>
      </div>
    )
  }

  const updating = updateAnimeMutation.isPending || recordAnimeMutation.isPending || refreshAnimeMutation.isPending
  const titleUrl = getProviderTitleUrl(anime.provider, anime.contentId)
  const providerName = providerLabel[anime.provider] ? providerLabel[anime.provider] : anime.provider
  const totalEpisodes = anime.seasons.reduce((sum, s) => sum + s.episodes.length, 0)
  const firstSeason = anime.seasons[0]
  const previewEpisodes = firstSeason ? firstSeason.episodes.slice(0, EPISODE_PREVIEW_LIMIT) : []
  const remainingEpisodes = firstSeason ? Math.max(0, firstSeason.episodes.length - previewEpisodes.length) : 0

  const toggleScheduled = () => {
    updateAnimeMutation.mutate({ scheduled: !anime.scheduled })
  }

  const toggleRecorded = async () => {
    if (!anime.recorded) {
      await recordAnimeMutation.mutateAsync()
    }
    updateAnimeMutation.mutate({ recorded: !anime.recorded })
  }

  return (
    <>
      <SheetHeader className='gap-2 px-4 pb-3 pt-4'>
        <SheetTitle className='text-base font-semibold tracking-tight'>{anime.title}</SheetTitle>
        <SheetDescription className='sr-only'>{content.description({ title: anime.title })}</SheetDescription>
        <div className='flex flex-wrap items-center gap-1.5'>
          <ProviderBadge provider={anime.provider} />
          {anime.status && anime.status !== 'UNKNOWN' && <StatusBadge status={anime.status} />}
          {anime.year > 0 && (
            <Badge variant='secondary'>
              {anime.year}
              {content.yearSuffix}
              {anime.quarter != null ? ` ${QuarterLabel[anime.quarter]}` : ''}
            </Badge>
          )}
        </div>
      </SheetHeader>

      <div className='flex-1 overflow-y-auto px-4 py-3'>
        {anime.imageUrl && (
          <div className='mb-4 overflow-hidden rounded-lg'>
            <ProxyImage
              src={anime.imageUrl}
              alt={anime.title}
              slotWidth={416}
              className='aspect-video w-full object-cover'
            />
          </div>
        )}

        <div className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              size='sm'
              variant={anime.scheduled ? 'default' : 'secondary'}
              onClick={toggleScheduled}
              disabled={updating}
              aria-pressed={anime.scheduled}
            >
              {anime.scheduled ? <CircleCheck /> : <Circle />}
              {anime.scheduled ? content.schedule.scheduled : content.schedule.unscheduled}
            </Button>
            <Button
              type='button'
              size='sm'
              variant={anime.recorded ? 'default' : 'secondary'}
              onClick={toggleRecorded}
              disabled={updating}
              aria-pressed={anime.recorded}
              className={anime.recorded ? 'bg-success text-success-foreground hover:bg-success/85' : undefined}
            >
              {anime.recorded ? <CircleCheck /> : <Circle />}
              {anime.recorded ? content.record.recorded : content.record.unrecorded}
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => refreshAnimeMutation.mutate()}
              disabled={updating}
              aria-label={content.refresh.ariaLabel.value}
            >
              <RefreshCw className={refreshAnimeMutation.isPending ? 'animate-spin' : undefined} />
            </Button>
          </div>

          {anime.description && <p className='text-sm leading-relaxed text-muted-foreground'>{anime.description}</p>}

          {totalEpisodes > 0 && (
            <p className='text-xs text-muted-foreground'>{content.episodes.count({ count: totalEpisodes })}</p>
          )}

          {previewEpisodes.length > 0 && (
            <section className='space-y-1.5 pt-1'>
              <h3 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {content.episodes.previewHeading({ count: previewEpisodes.length })}
              </h3>
              <ul className='space-y-1.5'>
                {previewEpisodes.map((ep) => (
                  <li key={ep.id} className='flex items-center gap-2 text-xs'>
                    <span className='shrink-0 text-muted-foreground'>{ep.episodeNumber}.</span>
                    <span className='truncate'>{ep.title}</span>
                    {ep.releaseDate && (
                      <span className='ml-auto shrink-0 text-muted-foreground'>
                        {dayjs(ep.releaseDate).format('M/D')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {remainingEpisodes > 0 && (
                <p className='text-xs text-muted-foreground'>{content.episodes.more({ count: remainingEpisodes })}</p>
              )}
            </section>
          )}
        </div>
      </div>

      <div className='flex flex-col gap-2 border-t px-4 py-3'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          render={
            <Link to='/anime/$id' params={{ id: anime.id }} onClick={onClose}>
              {content.openFullPage}
              <ExternalLink data-icon='inline-end' />
            </Link>
          }
        />
        {titleUrl && (
          <Button
            size='sm'
            variant='ghost'
            render={
              <a href={titleUrl} target='_blank' rel='noopener noreferrer'>
                {content.watchOn({ provider: providerName })}
                <ExternalLink data-icon='inline-end' />
              </a>
            }
          />
        )}
      </div>
    </>
  )
}
