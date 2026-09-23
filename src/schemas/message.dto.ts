import { z } from 'zod'

// 投入元の sync_runs.id。Queue バッチの run を cron の run に紐付けるためだけに使う。
// in-flight のメッセージを壊さないよう必ず optional にしておくこと。
const runId = z.string().optional()

export const ProviderTypeEnum = z.enum(['amazon', 'hulu', 'crunchyroll', 'abema'])
export const FetchCategoryEnum = z.enum(['new_episode', 'coming_soon', 'expiring', 'catalog'])

const FetchMessageBodySchema = z.object({
  provider: ProviderTypeEnum,
  category: FetchCategoryEnum
})

const UpdateMessageBodySchema = z.object({
  contentId: z.string().nonempty(),
  provider: ProviderTypeEnum
})

const BulkUpdateMessageBodySchema = z.object({
  contentIds: z.array(z.string().nonempty()).nonempty(),
  provider: ProviderTypeEnum
})

export const FetchMessageSchema = z.object({
  type: z.literal('fetch'),
  runId,
  message: FetchMessageBodySchema
})
export type FetchMessage = z.infer<typeof FetchMessageSchema>

export const UpdateMessageSchema = z.object({
  type: z.literal('update'),
  runId,
  message: UpdateMessageBodySchema
})
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>

export const BulkUpdateMessageSchema = z.object({
  type: z.literal('bulk_update'),
  runId,
  message: BulkUpdateMessageBodySchema
})
export type BulkUpdateMessage = z.infer<typeof BulkUpdateMessageSchema>

const AbemaArchiveBodySchema = z.object({
  animeId: z.string().nonempty()
})

export const AbemaArchiveMessageSchema = z.object({
  type: z.literal('abema_archive'),
  runId,
  message: AbemaArchiveBodySchema
})
export type AbemaArchiveMessage = z.infer<typeof AbemaArchiveMessageSchema>

const AnilistSyncBodySchema = z.object({
  year: z.number().int().min(1900).max(2100),
  country: z.enum(['JP', 'CN', 'KR', 'TW']).default('JP')
})

export const AnilistSyncMessageSchema = z.object({
  type: z.literal('anilist_sync'),
  runId,
  message: AnilistSyncBodySchema
})
export type AnilistSyncMessage = z.infer<typeof AnilistSyncMessageSchema>

export const MessageSchema = z.discriminatedUnion('type', [
  FetchMessageSchema,
  UpdateMessageSchema,
  BulkUpdateMessageSchema,
  AbemaArchiveMessageSchema,
  AnilistSyncMessageSchema
])
export type Message = z.infer<typeof MessageSchema>
