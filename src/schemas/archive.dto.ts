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
