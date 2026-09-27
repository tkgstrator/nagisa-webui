import dayjs from 'dayjs'
import type { ExpiringResponse, TitleListResponse } from '@/schemas/lambda.dto.ts'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import { recordCatalogEvents } from '../catalog-event'
import { getAppLogger } from '../logger'
import { cleanTitle } from '../metadata/anilist'
import { identifyTitlesViaD1 } from '../metadata/local-anilist'
import { animeUuid } from './ids'
import { D1_VARIABLE_LIMIT, findExistingContentIds, findKnownContentIds } from './queries'

/** ISO 8601 文字列を Date に変換し、過去なら null を返す */
export function parseFutureDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const d = dayjs(dateStr)
  return d.isAfter(dayjs()) ? d.toDate() : null
}

const syncLogger = getAppLogger('sync')
const fetchLogger = getAppLogger('fetch')

/** 新着エピソード / 最近更新取得: Lambda レスポンス → AniList 識別 + DB INSERT + nextEpisodeDate 更新 */
export async function fetchTitleList(
  prisma: PrismaClient,
  providerName: string,
  category: string,
  result: TitleListResponse
): Promise<string[]> {
  // new_episode の場合、COMING_SOON タイトル（nextEpisodeDate あり）を除外して上書きを防ぐ
  const comingSoonContentIds =
    category === 'new_episode'
      ? new Set(result.entries.filter((t) => t.badge === 'COMING_SOON').map((t) => t.contentId))
      : new Set<string>()
  const titles = result.entries.filter((t) => !comingSoonContentIds.has(t.contentId))

  if (comingSoonContentIds.size > 0) {
    fetchLogger.info({
      action: 'skip-coming-soon',
      provider: providerName,
      count: comingSoonContentIds.size
    })
  }

  const existingIds = await findExistingContentIds(
    prisma,
    titles.map((t) => t.contentId)
  )
  const knownIds = await findKnownContentIds(
    prisma,
    providerName,
    titles.map((t) => t.contentId)
  )
  const newTitles = titles.filter((t) => !knownIds.has(t.contentId))
  fetchLogger.info({
    action: 'check-titles',
    provider: providerName,
    category,
    total: titles.length,
    existing: existingIds.size,
    unidentified: knownIds.size - existingIds.size,
    new: newTitles.length
  })

  // このカテゴリに対応するバッジを持つタイトルのうち、今回の取得結果に含まれないものをリセット
  const badgesForCategory: Record<string, string[]> = {
    new_episode: ['NEW_EPISODE', 'RECENTLY_ADDED'],
    coming_soon: ['COMING_SOON']
  }
  const targetBadges = badgesForCategory[category] ?? []
  const allContentIds = new Set(titles.map((t) => t.contentId))

  if (targetBadges.length > 0) {
    const titlesHavingBadge = await prisma.anime.findMany({
      where: { provider: providerName, badge: { in: targetBadges } },
      select: { contentId: true }
    })
    const idsToReset = titlesHavingBadge.filter((t) => !allContentIds.has(t.contentId)).map((t) => t.contentId)
    let resetCount = 0
    for (let i = 0; i < idsToReset.length; i += D1_VARIABLE_LIMIT) {
      const chunk = idsToReset.slice(i, i + D1_VARIABLE_LIMIT)
      const { count } = await prisma.anime.updateMany({
        where: { contentId: { in: chunk } },
        data: { badge: null, nextEpisodeDate: null }
      })
      resetCount += count
    }
    if (resetCount > 0) {
      fetchLogger.info({
        action: 'reset-badge',
        provider: providerName,
        category,
        badges: targetBadges,
        count: resetCount
      })
    }
  }

  // バッチで anilist_media を D1 lookup し、識別済みの新規タイトルを DB に INSERT
  // AniList search backend 障害中なので Lambda /identify は使わず、事前 sync 済みの
  // anilist_media テーブルを normalized title で引く。
  const BATCH_SIZE = 20
  const identifiedContentIds: string[] = []

  for (let i = 0; i < newTitles.length; i += BATCH_SIZE) {
    const batch = newTitles.slice(i, i + BATCH_SIZE)
    fetchLogger.debug({
      action: 'identify-batch',
      provider: providerName,
      batchIndex: Math.floor(i / BATCH_SIZE),
      batchSize: batch.length,
      titles: batch.map((t) => t.title)
    })
    const results = await identifyTitlesViaD1(
      prisma,
      batch.map((t) => t.title)
    )

    for (let j = 0; j < batch.length; j++) {
      const meta = results[j]
      const t = batch[j]
      if (meta?.aniListId != null) {
        const nextEpisodeDate = parseFutureDate(t.nextEpisodeDate)
        const created = await prisma.anime.create({
          data: {
            id: animeUuid(providerName, t.contentId),
            provider: providerName,
            contentId: t.contentId,
            title: meta.title,
            description: t.description,
            entityType: t.entityType,
            maturityRating: t.maturityRating,
            imageUrl: t.imageUrl ?? '',
            aniListId: meta.aniListId,
            badge: t.badge,
            nextEpisodeDate
          }
        })
        fetchLogger.info({
          action: 'create-anime',
          provider: providerName,
          category,
          contentId: t.contentId,
          title: meta.title,
          aniListId: meta.aniListId,
          nextEpisodeDate: nextEpisodeDate ? dayjs(nextEpisodeDate).toISOString() : null
        })
        await recordCatalogEvents(prisma, [
          {
            animeId: created.id,
            provider: providerName,
            contentId: t.contentId,
            title: meta.title,
            kind: 'title-added'
          }
        ])
        identifiedContentIds.push(t.contentId)
      } else {
        await prisma.unidentifiedAnime.upsert({
          where: { provider_contentId: { provider: providerName, contentId: t.contentId } },
          create: { provider: providerName, contentId: t.contentId, title: t.title, imageUrl: t.imageUrl ?? null },
          update: { title: t.title, imageUrl: t.imageUrl ?? null }
        })
        syncLogger.debug({
          action: 'unidentified',
          provider: providerName,
          title: t.title,
          search: cleanTitle(t.title),
          contentId: t.contentId
        })
      }
    }
  }

  // 既存タイトルの badge / nextEpisodeDate を更新
  const existingTitles = titles.filter((t) => existingIds.has(t.contentId))
  for (const t of existingTitles) {
    const nextEpisodeDate = parseFutureDate(t.nextEpisodeDate)
    await prisma.anime.update({
      where: { provider_contentId: { provider: providerName, contentId: t.contentId } },
      data: { badge: t.badge, nextEpisodeDate }
    })
  }
  if (existingTitles.length > 0) {
    fetchLogger.debug({
      action: 'update-badge-and-dates',
      provider: providerName,
      count: existingTitles.length
    })
  }

  // バッジ付きタイトルだけを update 対象にする
  const updateTargets = titles.filter((t) => existingIds.has(t.contentId) && t.badge)

  fetchLogger.info({
    action: 'fetch-title-list-done',
    provider: providerName,
    category,
    identified: identifiedContentIds.length,
    updateTargets: updateTargets.length,
    unidentifiedCreated: newTitles.length - identifiedContentIds.length
  })

  return [...updateTargets.map((t) => t.contentId), ...identifiedContentIds]
}

/** 配信終了間近取得: Lambda レスポンスの expiredAt データで DB を更新 */
export async function fetchExpiring(
  prisma: PrismaClient,
  providerName: string,
  result: ExpiringResponse
): Promise<string[]> {
  const { fetchedAt, entries } = result

  fetchLogger.info({
    action: 'expiring-cache-loaded',
    provider: providerName,
    fetchedAt,
    count: entries.length
  })

  const existingIds = await findExistingContentIds(
    prisma,
    entries.map((e) => e.contentId)
  )

  const targets = entries.filter((e) => existingIds.has(e.contentId))

  fetchLogger.debug({
    action: 'expiring-titles-fetched',
    provider: providerName,
    total: entries.length,
    existing: existingIds.size,
    targets: targets.length
  })

  for (const e of targets) {
    await prisma.anime.update({
      where: { provider_contentId: { provider: providerName, contentId: e.contentId } },
      data: { badge: 'EXPIRING', expiredAt: dayjs(e.expiredAt).toDate(), expiringSeason: e.expiringSeason }
    })
    fetchLogger.debug({
      action: 'update-expiring-title',
      provider: providerName,
      contentId: e.contentId,
      expiredAt: e.expiredAt,
      expiringSeason: e.expiringSeason
    })
  }

  // 配信終了一覧から消えたタイトルの expiredAt をリセット
  const expiringContentIds = new Set(targets.map((e) => e.contentId))
  const titlesHavingExpiring = await prisma.anime.findMany({
    where: { provider: providerName, expiredAt: { not: null } },
    select: { contentId: true }
  })
  const expiringIdsToReset = titlesHavingExpiring
    .filter((t) => !expiringContentIds.has(t.contentId))
    .map((t) => t.contentId)
  let expiringResetCount = 0
  for (let i = 0; i < expiringIdsToReset.length; i += D1_VARIABLE_LIMIT) {
    const chunk = expiringIdsToReset.slice(i, i + D1_VARIABLE_LIMIT)
    const { count } = await prisma.anime.updateMany({
      where: { contentId: { in: chunk } },
      data: { badge: null, expiredAt: null, expiringSeason: null }
    })
    expiringResetCount += count
  }
  if (expiringResetCount > 0) {
    fetchLogger.info({
      action: 'reset-expiring',
      provider: providerName,
      count: expiringResetCount
    })
  }
  if (targets.length > 0) {
    fetchLogger.info({
      action: 'update-expiring',
      provider: providerName,
      count: targets.length
    })
  }

  return targets.map((e) => e.contentId)
}
