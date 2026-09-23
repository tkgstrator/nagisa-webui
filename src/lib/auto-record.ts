/**
 * 予約済み作品 (`Anime.scheduled`) の自動録画。
 *
 * エピソード同期 (Queue の update / 作品ページの手動再取得) の直後に呼び、配信済みでまだ
 * 録画に回していない回を nagisa に送る。送信と結果は `recording_events` に source 'cron' で残る。
 *
 * 対象の選び方:
 *   - `recordStatus = 'none'` (一度も送っていない) かつ配信日が直近 `LOOKBACK_DAYS` 日以内
 *   - 「今回の同期で新しく入った回」で選ばないのは、配信日より前にカタログへ載る回があるため。
 *     その回は配信日を過ぎた後の同期で拾う (update は新着バッジの付いた作品に毎時飛ぶ)。
 *   - 過去回まで遡らないのは、予約を入れた瞬間に未録画の旧作を一斉に送らないため。
 *     旧作は作品ページの録画ボタン (manual) で送る。
 *   - 送信に失敗した回は `none` のまま残るので、次の同期で自然に再送される。
 *
 * **throw しない**。自動録画が失敗しても同期そのもの (Queue の再試行) を巻き込まない。
 */

import { NagisaEnqueueRequestSchema } from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'
import type { NagisaEnv } from './nagisa-client'
import { enqueueRecording } from './record-enqueue'

const logger = getAppLogger('auto-record')

type Prisma = ReturnType<typeof createPrismaClient>

/** 配信日がこれより古い未録画回は自動では送らない */
const LOOKBACK_DAYS = 7

export interface AutoRecordResult {
  /** 送った話数。予約されていない / 対象が無いときは 0 */
  sent: number
  ok: boolean
}

export async function autoRecordScheduled(
  prisma: Prisma,
  env: Partial<NagisaEnv>,
  provider: string,
  contentId: string,
  now: Date = new Date()
): Promise<AutoRecordResult> {
  try {
    const anime = await prisma.anime.findUnique({
      where: { provider_contentId: { provider, contentId } },
      select: { id: true, scheduled: true }
    })
    if (!anime?.scheduled) return { sent: 0, ok: true }

    // netflix など nagisa が録れない配信元は予約されていても送らない
    const nagisaProvider = NagisaEnqueueRequestSchema.shape.provider.safeParse(provider)
    if (!nagisaProvider.success) {
      logger.warn({ action: 'auto-record-unsupported-provider', provider, contentId })
      return { sent: 0, ok: true }
    }

    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const episodes = await prisma.episode.findMany({
      where: {
        season: { animeId: anime.id, seasonNumber: { gt: 0 } },
        episodeNumber: { gt: 0 },
        recordStatus: 'none',
        recorded: false,
        releaseDate: { gt: since, lte: now }
      },
      select: { episodeNumber: true, season: { select: { seasonNumber: true } } },
      orderBy: [{ season: { seasonNumber: 'asc' } }, { episodeNumber: 'asc' }]
    })
    if (episodes.length === 0) return { sent: 0, ok: true }

    const seasonMap = new Map<number, number[]>()
    for (const ep of episodes) {
      const eps = seasonMap.get(ep.season.seasonNumber)
      if (eps) eps.push(ep.episodeNumber)
      else seasonMap.set(ep.season.seasonNumber, [ep.episodeNumber])
    }
    const seasons = [...seasonMap.entries()].map(([season_number, episodes]) => ({ season_number, episodes }))

    logger.info({ action: 'auto-record-send', provider, contentId, episodeCount: episodes.length })
    const result = await enqueueRecording(
      prisma,
      env,
      { provider: nagisaProvider.data, items: [{ content_id: contentId, seasons }] },
      'cron'
    )
    if (!result.ok) {
      logger.warn({ action: 'auto-record-failed', provider, contentId, error: result.error })
    }
    return { sent: result.ok ? episodes.length : 0, ok: result.ok }
  } catch (e) {
    logger.error({
      action: 'auto-record-error',
      provider,
      contentId,
      error: e instanceof Error ? e.message : String(e)
    })
    return { sent: 0, ok: false }
  }
}
