/**
 * provider ごとに送信先 queue を振り分ける唯一の窓口。
 *
 * Amazon はスクレイピング先の throttle 対策で専用 queue (`AMAZON_QUEUE`, 実効並列度 2) に
 * 隔離する。それ以外の provider (hulu/crunchyroll/abema) と provider を持たない message 型
 * (abema_archive/anilist_sync) は共有の `SYNC_QUEUE` (実効並列度 10) に流す。
 *
 * 送信箇所ごとに binding を選ばせると provider の抜き漏れでズレるため、
 * `src/scheduled.ts` / `src/queue.ts` / `src/routes/admin.ts` は必ずこの関数経由で送る。
 * `image_warm` は provider に関わらず常に `WARM_QUEUE` 固定なのでこのルーティングの対象外
 * (呼び出し元が直接 `env.WARM_QUEUE` / `enqueueImageWarm` を使う)。
 */
import type { z } from 'zod'
import type { Message, ProviderTypeEnum } from '../schemas/message.dto'

type Provider = z.infer<typeof ProviderTypeEnum>

export interface QueueRoutingEnv {
  AMAZON_QUEUE: Queue<Message>
  SYNC_QUEUE: Queue<Message>
}

/** provider (無ければ sync 扱い) から送信先 queue を決める */
export function resolveQueueForProvider(env: QueueRoutingEnv, provider: Provider | undefined): Queue<Message> {
  return provider === 'amazon' ? env.AMAZON_QUEUE : env.SYNC_QUEUE
}

/** message の中身 (fetch/update は provider を持つ) から送信先 queue を決める */
export function resolveQueue(env: QueueRoutingEnv, message: Message): Queue<Message> {
  const provider = message.type === 'fetch' || message.type === 'update' ? message.message.provider : undefined
  return resolveQueueForProvider(env, provider)
}

/** message を適切な queue へ 1 件送る */
export async function sendMessage(env: QueueRoutingEnv, message: Message, options?: QueueSendOptions): Promise<void> {
  await resolveQueue(env, message).send(message, options)
}
