import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { KeyArchiveProviderEnum } from '@/schemas/archive.dto'
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

export const recorderStatusQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.recorder.status, queryFn: () => api.getRecorderStatus(), refetchInterval: 15_000 })

/**
 * 上流 (録画サーバー) を叩く 2 本は落ちていることが正常系なので、**失敗しても再試行しない**。
 * 15 秒ごとのポーリングがそのまま次の試行になるし、ここで retry を積むと
 * 上流が落ちている間だけ画面が「読み込み中」のまま固まる。
 */
export const recorderQueueSnapshotQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.recorder.queueSnapshot,
    queryFn: () => api.getRecorderQueueSnapshot(),
    refetchInterval: 15_000,
    retry: false
  })

export const recordingLibraryStatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.recordingLibrary.stats,
    queryFn: () => api.getRecordingLibraryStats(),
    refetchInterval: 30_000,
    retry: false
  })

/** こちらはローカル D1 だけを見るので、上流が落ちていても必ず返る。 */
export const recordingSyncStateQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.recordingLibrary.syncState,
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

export const syncRunStatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.admin.syncRunStats,
    queryFn: () => api.getSyncRunStats(),
    refetchInterval: 30_000
  })

export const archiveStatsQueryOptions = (provider: KeyArchiveProviderEnum) =>
  queryOptions({
    queryKey: queryKeys.admin.archiveStats(provider),
    queryFn: () => api.getArchiveStats({ queries: { provider } })
  })

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
