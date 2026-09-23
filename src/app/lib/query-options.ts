import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import api from './api'
import { queryKeys } from './query-keys'

export const animeListQueryOptions = (filters: Record<string, unknown>) =>
  queryOptions({ queryKey: queryKeys.anime.list(filters), queryFn: () => api.getAnimeList({ queries: filters }) })

const scheduledCountFilters = { scheduled: true, limit: 1, page: 1 } as const

export const scheduledCountQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.anime.list(scheduledCountFilters as Record<string, unknown>),
    queryFn: () => api.getAnimeList({ queries: scheduledCountFilters }),
    select: (data) => data.total,
    staleTime: 30_000
  })

export const badgedAnimeQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.anime.badged, queryFn: () => api.getBadgedAnime() })

export const animeDetailQueryOptions = (id: string) =>
  queryOptions({ queryKey: queryKeys.anime.detail(id), queryFn: () => api.getAnime({ params: { id } }) })

/** 上流が落ちていても 200 + error で返るので、再試行は要らない。 */
export const animeRecordingStatusQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.anime.recordingStatus(id),
    queryFn: () => api.getAnimeRecordingStatus({ params: { id } }),
    retry: false
  })

export const nagisaStatusQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.nagisa.status, queryFn: () => api.getNagisaStatus(), refetchInterval: 15_000 })

/**
 * 上流 (nagisa) を叩く 2 本は落ちていることが正常系なので、**失敗しても再試行しない**。
 * 15 秒ごとのポーリングがそのまま次の試行になるし、ここで retry を積むと
 * 上流が落ちている間だけ画面が「読み込み中」のまま固まる。
 */
export const nagisaQueueSnapshotQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.nagisa.queueSnapshot,
    queryFn: () => api.getNagisaQueueSnapshot(),
    refetchInterval: 15_000,
    retry: false
  })

export const nagisaLibraryStatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.nagisa.libraryStats,
    queryFn: () => api.getNagisaLibraryStats(),
    refetchInterval: 30_000,
    retry: false
  })

/** こちらはローカル D1 だけを見るので、上流が落ちていても必ず返る。 */
export const recordingSyncStateQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.nagisa.syncState,
    queryFn: () => api.getRecordingSyncState(),
    refetchInterval: 30_000
  })

export const unidentifiedListQueryOptions = (filters: Record<string, unknown>) =>
  queryOptions({
    queryKey: queryKeys.admin.unidentified(filters),
    queryFn: () => api.getUnidentifiedList({ queries: filters })
  })

export const syncRunsQueryOptions = (filters: Record<string, unknown>) =>
  queryOptions({
    queryKey: queryKeys.admin.syncRuns(filters),
    queryFn: () => api.getSyncRuns({ queries: filters }),
    refetchInterval: 30_000
  })

export const syncRunQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.admin.syncRun(id),
    queryFn: () => api.getSyncRun({ params: { id } }),
    refetchInterval: 30_000
  })

// 生ログは書き込みの最中に行がずれるので、ページ番号ではなく id の降順カーソルで継ぎ足す。
export const logEntriesQueryOptions = (filters: Record<string, unknown>) =>
  infiniteQueryOptions({
    queryKey: queryKeys.admin.logEntries(filters),
    queryFn: ({ pageParam }) =>
      api.getLogEntries({ queries: { ...filters, ...(pageParam === undefined ? {} : { cursor: pageParam }) } }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000
  })

export const recordingEventsQueryOptions = (filters: Record<string, unknown>) =>
  queryOptions({
    queryKey: queryKeys.admin.recordingEvents(filters),
    queryFn: () => api.getRecordingEvents({ queries: filters }),
    refetchInterval: 30_000
  })

export const catalogEventsQueryOptions = (filters: Record<string, unknown>) =>
  queryOptions({
    queryKey: queryKeys.admin.catalogEvents(filters),
    queryFn: () => api.getCatalogEvents({ queries: filters }),
    refetchInterval: 30_000
  })

export const logStatsQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.admin.logStats, queryFn: () => api.getLogStats(), refetchInterval: 30_000 })

export const archiveStatsQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.admin.archiveStats, queryFn: () => api.getArchiveStats() })

export type ChangelogEntry = { hash: string; date: string; message: string }

export const changelogQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.changelog,
    queryFn: async (): Promise<ChangelogEntry[]> => {
      const res = await fetch('/commits.json')
      if (!res.ok) throw new Error(`Failed to load changelog: ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000
  })
