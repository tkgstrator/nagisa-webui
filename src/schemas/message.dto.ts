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

/** 上限 10 は Lambda 側の FetchImageRequestSchema (src/schemas/lambda.dto.ts) と揃える。1 message = Lambda 1 往復。 */
const ImageWarmMessageBodySchema = z.object({
  provider: ProviderTypeEnum,
  urls: z.array(z.url()).min(1).max(10)
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

export const ImageWarmMessageSchema = z.object({
  type: z.literal('image_warm'),
  runId,
  message: ImageWarmMessageBodySchema
})
export type ImageWarmMessage = z.infer<typeof ImageWarmMessageSchema>

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
  ImageWarmMessageSchema,
  AbemaArchiveMessageSchema,
  AnilistSyncMessageSchema
])
export type Message = z.infer<typeof MessageSchema>
