import { z } from 'zod'

export const ArchiveEnqueueResponseSchema = z.object({
  enqueued: z.number().int().min(0)
})
export type ArchiveEnqueueResponseSchema = z.infer<typeof ArchiveEnqueueResponseSchema>

export const ArchiveStatsSchema = z.object({
  totalAnime: z.number().int().min(0),
  animeFullyArchived: z.number().int().min(0),
  animeWithMissingKey: z.number().int().min(0),
  totalEpisodes: z.number().int().min(0),
  archivedEpisodes: z.number().int().min(0),
  pendingEpisodes: z.number().int().min(0)
})
export type ArchiveStatsSchema = z.infer<typeof ArchiveStatsSchema>

/** HLS 鍵アーカイブの対象 provider。現状 ABEMA のみ */
export const KeyArchiveProviderEnum = z.enum(['abema'])
export type KeyArchiveProviderEnum = z.infer<typeof KeyArchiveProviderEnum>

export const KeyArchiveRequestSchema = z.object({
  provider: KeyArchiveProviderEnum
})
export type KeyArchiveRequestSchema = z.infer<typeof KeyArchiveRequestSchema>

export const KeyArchiveStatsQuerySchema = z.object({
  provider: KeyArchiveProviderEnum.default('abema')
})
export type KeyArchiveStatsQuerySchema = z.infer<typeof KeyArchiveStatsQuerySchema>
