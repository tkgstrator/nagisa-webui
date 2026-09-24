import { Zodios } from '@qtmleap/zodios'
import { z } from 'zod'
import {
  AnimeInfoSchema,
  AnimeSchema,
  BadgedAnimeSchema,
  PaginatedAnimeSchema,
  RecordAnimeRequestSchema,
  RefreshAnimeResponseSchema
} from '@/schemas/anime.dto'
import {
  ArchiveEnqueueResponseSchema,
  ArchiveStatsSchema,
  KeyArchiveProviderEnum,
  KeyArchiveRequestSchema
} from '@/schemas/archive.dto'
import {
  CursoredLogEntrySchema,
  LogStatsSchema,
  PaginatedRecordingEventSchema,
  PaginatedSyncRunSchema,
  SyncRunDetailSchema
} from '@/schemas/log.dto'
import {
  NagisaEnqueueRequestSchema,
  NagisaEnqueueResponseSchema,
  NagisaLibraryStatsSchema,
  NagisaQueueResponseSchema,
  NagisaQueueSnapshotSchema,
  NagisaStatusSchema
} from '@/schemas/nagisa.dto'
import {
  BulkUpdateEpisodeSchema,
  LibraryManualSyncResponseSchema,
  RecordingSyncStateSchema,
  UpdateEpisodeSchema
} from '@/schemas/recording.dto'
import { PaginatedUnidentifiedSchema } from '@/schemas/unidentified.dto'

const api = new Zodios('/api', [
  {
    method: 'get',
    path: '/anime',
    alias: 'getAnimeList',
    parameters: [
      { name: 'page', type: 'Query', schema: z.number().int().min(1).optional() },
      { name: 'limit', type: 'Query', schema: z.number().int().min(1).max(100).optional() },
      { name: 'provider', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'year', type: 'Query', schema: z.number().int().optional() },
      { name: 'quarter', type: 'Query', schema: z.number().int().min(0).max(3).optional() },
      { name: 'status', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'badge', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'aniListId', type: 'Query', schema: z.number().int().optional() },
      { name: 'scheduled', type: 'Query', schema: z.boolean().optional() },
      { name: 'recorded', type: 'Query', schema: z.boolean().optional() },
      { name: 'sort', type: 'Query', schema: z.enum(['title', 'year', 'updatedAt']).optional() },
      { name: 'order', type: 'Query', schema: z.enum(['asc', 'desc']).optional() },
      { name: 'q', type: 'Query', schema: z.string().nonempty().optional() }
    ],
    response: PaginatedAnimeSchema
  },
  {
    method: 'get',
    path: '/anime/badged',
    alias: 'getBadgedAnime',
    response: BadgedAnimeSchema
  },
  {
    method: 'get',
    path: '/anime/:id',
    alias: 'getAnime',
    response: AnimeInfoSchema
  },
  {
    method: 'post',
    path: '/anime/:id/recording-jobs',
    alias: 'recordAnime',
    parameters: [{ name: 'body', type: 'Body', schema: RecordAnimeRequestSchema }],
    response: NagisaQueueResponseSchema
  },
  {
    method: 'post',
    path: '/anime/:id/refresh',
    alias: 'refreshAnime',
    response: RefreshAnimeResponseSchema
  },
  {
    method: 'patch',
    path: '/anime/:id',
    alias: 'updateAnime',
    parameters: [
      {
        name: 'body',
        type: 'Body',
        schema: z.object({
          scheduled: z.boolean().optional(),
          recorded: z.boolean().optional()
        })
      }
    ],
    response: AnimeSchema
  },
  {
    method: 'get',
    path: '/episodes',
    alias: 'getEpisodes',
    parameters: [{ name: 'recorded', type: 'Query', schema: z.boolean().optional() }],
    response: z.array(
      z.object({
        id: z.string(),
        episodeNumber: z.number().int(),
        title: z.string(),
        recorded: z.boolean(),
        season: z.object({
          displayName: z.string(),
          anime: z.object({
            id: z.string(),
            title: z.string(),
            provider: z.string(),
            contentId: z.string()
          })
        })
      })
    )
  },
  {
    method: 'patch',
    path: '/episodes/:id',
    alias: 'updateEpisode',
    parameters: [{ name: 'body', type: 'Body', schema: UpdateEpisodeSchema }],
    response: z.object({ id: z.string(), recorded: z.boolean() })
  },
  {
    method: 'patch',
    path: '/episodes',
    alias: 'bulkUpdateEpisodes',
    parameters: [{ name: 'body', type: 'Body', schema: BulkUpdateEpisodeSchema }],
    response: z.object({ updated: z.number() })
  },
  {
    method: 'get',
    path: '/recorder/status',
    alias: 'getRecorderStatus',
    response: NagisaStatusSchema
  },
  {
    method: 'get',
    path: '/recorder/queue/snapshot',
    alias: 'getRecorderQueueSnapshot',
    response: NagisaQueueSnapshotSchema
  },
  {
    method: 'get',
    path: '/recording-library/stats',
    alias: 'getRecordingLibraryStats',
    response: NagisaLibraryStatsSchema
  },
  {
    method: 'get',
    path: '/recording-library/sync-state',
    alias: 'getRecordingSyncState',
    response: RecordingSyncStateSchema
  },
  {
    method: 'get',
    path: '/admin/unidentified-anime',
    alias: 'getUnidentifiedList',
    parameters: [
      { name: 'page', type: 'Query', schema: z.number().int().min(1).optional() },
      { name: 'limit', type: 'Query', schema: z.number().int().min(1).max(100).optional() },
      { name: 'provider', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'q', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'order', type: 'Query', schema: z.enum(['asc', 'desc']).optional() }
    ],
    response: PaginatedUnidentifiedSchema
  },
  {
    method: 'get',
    path: '/admin/key-archives/stats',
    alias: 'getArchiveStats',
    parameters: [{ name: 'provider', type: 'Query', schema: KeyArchiveProviderEnum.optional() }],
    response: ArchiveStatsSchema
  },
  {
    method: 'post',
    path: '/admin/key-archive-requests',
    alias: 'enqueueArchive',
    parameters: [{ name: 'body', type: 'Body', schema: KeyArchiveRequestSchema }],
    response: ArchiveEnqueueResponseSchema
  },
  {
    method: 'get',
    path: '/admin/sync-runs',
    alias: 'getSyncRuns',
    parameters: [
      { name: 'page', type: 'Query', schema: z.number().int().min(1).optional() },
      { name: 'limit', type: 'Query', schema: z.number().int().min(1).max(100).optional() },
      { name: 'kind', type: 'Query', schema: z.enum(['cron', 'queue', 'manual']).optional() },
      { name: 'status', type: 'Query', schema: z.enum(['running', 'success', 'partial', 'failed']).optional() },
      { name: 'hours', type: 'Query', schema: z.number().int().min(1).max(2160).optional() }
    ],
    response: PaginatedSyncRunSchema
  },
  {
    method: 'get',
    path: '/admin/sync-runs/:id',
    alias: 'getSyncRun',
    response: SyncRunDetailSchema
  },
  {
    method: 'get',
    path: '/admin/logs/entries',
    alias: 'getLogEntries',
    parameters: [
      { name: 'limit', type: 'Query', schema: z.number().int().min(1).max(200).optional() },
      { name: 'cursor', type: 'Query', schema: z.number().int().min(1).optional() },
      { name: 'level', type: 'Query', schema: z.enum(['debug', 'info', 'warning', 'error', 'fatal']).optional() },
      { name: 'category', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'action', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'runId', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'hours', type: 'Query', schema: z.number().int().min(1).max(336).optional() },
      { name: 'q', type: 'Query', schema: z.string().nonempty().optional() }
    ],
    response: CursoredLogEntrySchema
  },
  {
    method: 'get',
    path: '/admin/recording-events',
    alias: 'getRecordingEvents',
    parameters: [
      { name: 'page', type: 'Query', schema: z.number().int().min(1).optional() },
      { name: 'limit', type: 'Query', schema: z.number().int().min(1).max(100).optional() },
      { name: 'animeId', type: 'Query', schema: z.string().nonempty().optional() },
      { name: 'kind', type: 'Query', schema: z.enum(['request', 'status', 'recorded', 'not-found']).optional() },
      { name: 'status', type: 'Query', schema: z.enum(['ok', 'error']).optional() },
      { name: 'hours', type: 'Query', schema: z.number().int().min(1).max(4320).optional() }
    ],
    response: PaginatedRecordingEventSchema
  },
  {
    method: 'get',
    path: '/admin/sync-runs/stats',
    alias: 'getSyncRunStats',
    response: LogStatsSchema
  },
  {
    method: 'post',
    path: '/recording-jobs',
    alias: 'enqueueRecordingJob',
    parameters: [{ name: 'body', type: 'Body', schema: NagisaEnqueueRequestSchema }],
    response: NagisaEnqueueResponseSchema
  },
  {
    method: 'post',
    path: '/recording-library/sync',
    alias: 'syncRecordingLibrary',
    response: LibraryManualSyncResponseSchema
  }
])

export default api
