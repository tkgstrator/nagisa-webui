import type { z } from '@hono/zod-openapi'
import { type NagisaEnqueueRequest, NagisaEnqueueResponseSchema } from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'
import { fetchNagisaRaw, missingNagisaConfig, type NagisaEnv } from './nagisa-client'
import { markPending } from './record-intent'
import { type RecordingEventInput, recordEvents } from './recording-event'

const logger = getAppLogger('record-enqueue')

type Prisma = ReturnType<typeof createPrismaClient>

export type EnqueueResult =
  | { ok: true; data: z.infer<typeof NagisaEnqueueResponseSchema> }
  | { ok: false; error: string; status?: number }

/** 履歴の引き当てで一度に投げる content_id の上限。D1 の bind 変数 (100) に収める。 */
const LOOKUP_MAX = 90

/**
 * 投入リクエスト 1 回ぶんを `recording_events` に残す。
 *
 * 投入の body は `content_id` しか持たないので、履歴に要る animeId と title は
 * ここで D1 から引き当てる。引けなかった content_id は**行を作らない** —
 * animeId の無い行は作品ページから辿れず、読み手が居ないため。
 *
 * 録画リクエスト本体の副作用なので、**ここで throw しない**。
 */
async function recordEnqueue(
  prisma: Prisma,
  body: NagisaEnqueueRequest,
  outcome: Pick<RecordingEventInput, 'kind' | 'status' | 'httpStatus' | 'errorMessage'>
): Promise<void> {
  try {
    const items = body.items.slice(0, LOOKUP_MAX)
    const rows = await prisma.anime.findMany({
      where: { provider: body.provider, contentId: { in: items.map((i) => i.content_id) } },
      select: { id: true, contentId: true, title: true }
    })
    const byContentId = new Map(rows.map((r) => [r.contentId, r]))
    const events: RecordingEventInput[] = []
    for (const item of items) {
      const anime = byContentId.get(item.content_id)
      if (!anime) continue
      // 話数指定が無い (= 作品まるごと) ときは件数を書かない。0 と区別が付かなくなる。
      const episodes = item.seasons?.flatMap((s) => s.episodes ?? []).length ?? 0
      events.push({
        animeId: anime.id,
        provider: body.provider,
        contentId: item.content_id,
        title: anime.title,
        source: 'ui',
        episodeCount: episodes > 0 ? episodes : null,
        ...outcome
      })
    }
    await recordEvents(prisma, events)
  } catch (e) {
    logger.warn({
      action: 'nagisa-enqueue-event-failed',
      error: e instanceof Error ? e.message : String(e)
    })
  }
}

/**
 * nagisa の `/api/queues` へ録画を投入し、履歴と D1 の控えまで済ませる。
 * 管理画面の単体投入と作品詳細の録画ボタンが同じ経路を通る。throw しない。
 */
export async function enqueueRecording(
  prisma: Prisma,
  env: Partial<NagisaEnv>,
  body: NagisaEnqueueRequest
): Promise<EnqueueResult> {
  const missing = missingNagisaConfig(env)
  if (missing.length > 0) {
    logger.error({ action: 'nagisa-enqueue-config-missing', missing })
    return { ok: false, error: `Nagisa config missing: ${missing.join(', ')}` }
  }
  try {
    const res = await fetchNagisaRaw(env, '/api/queues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text()
      logger.error({ action: 'nagisa-enqueue-error', status: res.status, body: text })
      // 404 は「上流に作品が無い」= 送り先の問題なので、通信失敗とは別の種別で残す。
      await recordEnqueue(prisma, body, {
        kind: res.status === 404 ? 'not-found' : 'request',
        status: 'error',
        httpStatus: res.status,
        errorMessage: text || `Nagisa returned ${res.status}`
      })
      return { ok: false, error: text || `Nagisa returned ${res.status}`, status: res.status }
    }
    const data = await res.json()
    logger.info({
      action: 'nagisa-enqueue-sent',
      provider: body.provider,
      items: body.items.map((i) => i.content_id)
    })

    // 受理されたジョブを D1 に控える。**ここで書かないと同期が始まらない**:
    // job id を持たない行は job-sync の追跡対象 (`recordJobId: { not: null }`)
    // から外れ、録画が走っていることも失敗したことも WebUI からは見えない。
    //
    // 控えに失敗しても投入は巻き戻せないので、結果は握って成功を返す
    // (markPending は throw しない)。実体が出来れば台帳同期が completed で拾う。
    await recordEnqueue(prisma, body, { kind: 'request', status: 'ok', httpStatus: res.status })

    const parsed = NagisaEnqueueResponseSchema.safeParse(data)
    if (parsed.success) {
      const intent = await markPending(prisma, parsed.data.jobs)
      if (intent.unmatched > 0 || intent.dropped > 0 || intent.truncated > 0) {
        logger.warn({ action: 'nagisa-enqueue-intent-partial', ...intent })
      }
    } else {
      // 投入自体は通っているので落とさない。ジョブの形が変わった (nagisa 側の
      // 契約変更) ことだけ残す — この回のエピソードは pending にならない。
      logger.error({ action: 'nagisa-enqueue-unparsable', error: parsed.error.message })
    }

    return { ok: true, data: data as z.infer<typeof NagisaEnqueueResponseSchema> }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error({ action: 'nagisa-enqueue-fetch-error', error: message })
    // 上流に届いていないので httpStatus は無い。null のまま残す。
    await recordEnqueue(prisma, body, {
      kind: 'request',
      status: 'error',
      errorMessage: `fetch failed: ${message}`
    })
    return { ok: false, error: 'Failed to connect to Nagisa' }
  }
}
