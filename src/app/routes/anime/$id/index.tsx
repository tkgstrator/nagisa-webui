import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import { animeDetailQueryOptions } from '@/app/lib/query-options'
import { useSettings } from '@/app/routes/settings/-lib/settings'
import { AnimeHero } from './-components/anime-hero'
import { AnimeInfo } from './-components/anime-info'
import { BroadcastSchedule } from './-components/broadcast-schedule'
import { EpisodeGrid } from './-components/episode-grid'
import { RelatedProviders } from './-components/related-providers'

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

function isNotFoundResponse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const response = (error as { response?: { status?: unknown } }).response
  return typeof response === 'object' && response !== null && (response as { status?: unknown }).status === 404
}

export const Route = createFileRoute('/anime/$id/')({
  loader: async ({ params, context: { queryClient } }) => {
    try {
      return await queryClient.ensureQueryData(animeDetailQueryOptions(params.id))
    } catch (error) {
      // 存在しない ID は ErrorBoundary ではなく 404 画面へ回す
      if (isNotFoundResponse(error)) throw notFound({ data: { animeId: params.id } })
      throw error
    }
  },
  pendingComponent: LoadingSpinner,
  component: AnimeDetailPage
})

function AnimeDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: anime } = useSuspenseQuery(animeDetailQueryOptions(id))
  const { settings } = useSettings()

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.anime.detail(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
  }

  const updateAnimeMutation = useMutation({
    mutationFn: (body: { scheduled?: boolean; recorded?: boolean }) => api.updateAnime(body, { params: { id } }),
    onSuccess: invalidateRelated
  })

  const recordAnimeMutation = useMutation({
    mutationFn: () => api.recordAnime(undefined, { params: { id } }),
    onSuccess: (data) => {
      if (data.count === 0) {
        toast.info('録画対象のエピソードがありません')
        return
      }
      toast.success('録画を開始しました')
    },
    onError: () => toast.error('録画リクエストに失敗しました'),
    // 失敗しても各話の録画状態は書き換わっているので読み直す
    onSettled: invalidateRelated
  })

  const refreshAnimeMutation = useMutation({
    mutationFn: () => api.refreshAnime(undefined, { params: { id } }),
    onSuccess: (data) => {
      // 配信元の更新は済んでいる。nagisa との同期だけが落ちた場合は、そうと分かるように出す
      if (data.sync.jobs.error !== null || data.sync.library.error !== null) {
        toast.warning('タイトル情報は更新しましたが、録画状態の同期に失敗しました', {
          description: data.sync.jobs.error ?? data.sync.library.error ?? undefined
        })
      } else {
        toast.success('タイトル情報と録画状態を更新しました')
      }
      invalidateRelated()
      queryClient.invalidateQueries({ queryKey: queryKeys.nagisa.syncState })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '情報の更新に失敗しました'))
  })

  const updating = updateAnimeMutation.isPending || recordAnimeMutation.isPending || refreshAnimeMutation.isPending

  const toggleScheduled = () => {
    updateAnimeMutation.mutate({ scheduled: !anime.scheduled })
  }

  /**
   * 録画済みに印を付けるとき、設定次第で未録画エピソードの録画リクエストも同時に送る。
   * 録画を削除する API がないので、録画済みからは戻せない (ボタン側も押せなくしてある)。
   */
  const markRecorded = async () => {
    if (anime.recorded) return
    if (settings.requestRecordingOnMark) {
      await recordAnimeMutation.mutateAsync()
    }
    updateAnimeMutation.mutate({ recorded: true })
  }

  const totalEpisodes = anime.seasons.reduce((sum, s) => sum + s.episodes.length, 0)
  const totalDuration = anime.seasons.reduce((sum, s) => sum + s.episodes.reduce((es, e) => es + e.duration, 0), 0)

  return (
    <PageContainer className='gap-10 max-sm:gap-[30px]'>
      <BroadcastSchedule anime={anime} />

      <nav className='flex items-center gap-1.5 text-[12.5px] text-muted-foreground' aria-label='パス'>
        <Link
          to='/browse'
          className='inline-flex items-center gap-1 rounded-md px-1.5 py-[3px] transition-colors hover:bg-muted hover:text-foreground'
        >
          <ChevronLeft className='size-3' />
          アニメ一覧
        </Link>
        <span>/</span>
        <span className='truncate font-semibold text-foreground'>{anime.title}</span>
      </nav>

      <AnimeHero
        anime={anime}
        totalEpisodes={totalEpisodes}
        totalDuration={totalDuration}
        updating={updating}
        refreshing={refreshAnimeMutation.isPending}
        onToggleScheduled={toggleScheduled}
        onToggleRecorded={markRecorded}
        onRefresh={() => refreshAnimeMutation.mutate()}
      />

      <div className='grid grid-cols-[minmax(0,1fr)_280px] items-start gap-8 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-7'>
        <EpisodeGrid anime={anime} />
        <aside className='sticky top-6 flex flex-col gap-6 max-lg:static'>
          <RelatedProviders anime={anime} />
          <AnimeInfo anime={anime} />
        </aside>
      </div>
    </PageContainer>
  )
}
