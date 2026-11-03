/**
 * anilist_media の最終 synced_at が一定日数更新されていなければ Discord に通知する。
 * 週次同期が黙って全滅する (Workers が AniList に 403 でブロックされる等) のを検知するための保険。
 */
import dayjs from 'dayjs'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import { COLOR_WARN, notify } from '../discord'
import { getAppLogger } from '../logger'

const logger = getAppLogger('anilist-staleness')

/** 週次同期が 2 回連続で書けなかったら異常とみなす日数 */
export const ANILIST_STALE_DAYS = 14

/** 古ければ通知して true を返す。`anilist_media` が空の場合も古いものとして扱う。 */
export async function notifyIfAnilistStale(
  prisma: PrismaClient,
  webhookUrl: string,
  now: Date = new Date(),
  staleDays = ANILIST_STALE_DAYS
): Promise<boolean> {
  const latest = await prisma.anilistMedia.aggregate({ _max: { syncedAt: true } })
  const lastSyncedAt = latest._max.syncedAt
  const ageDays = lastSyncedAt ? dayjs(now).diff(lastSyncedAt, 'day') : null
  if (ageDays !== null && ageDays < staleDays) return false

  logger.warn({ action: 'anilist-stale', lastSyncedAt: lastSyncedAt?.toISOString() ?? null, ageDays })
  await notify(webhookUrl, {
    title: 'AniList: anilist_media が更新されていません',
    description: `最終同期から ${ageDays ?? '不明'} 日経過しています (閾値 ${staleDays} 日)。Lambda 経由の取得が失敗していないか確認してください。`,
    color: COLOR_WARN,
    fields: [{ name: '最終 synced_at', value: lastSyncedAt?.toISOString() ?? 'なし', inline: true }]
  })
  return true
}
