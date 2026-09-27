import dayjs from 'dayjs'
import type { FetchMessage, UpdateMessage } from '@/schemas/message.dto.ts'
import type { Episode, Season, TitleInfo } from '@/schemas/providers/common.dto.ts'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import { type CatalogEventInput, recordCatalogEvents } from '../catalog-event'
import { withD1Retry } from '../db'
import type { FetchClient } from '../lambda'
import { getAppLogger } from '../logger'
import { fetchExpiring, fetchTitleList } from './catalog'
import { episodeUuid, seasonUuid } from './ids'

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002'
}

const syncLogger = getAppLogger('sync')
const fetchLogger = getAppLogger('fetch')

/** 既存エピソードで変わった項目。カタログログの「更新」行に載せる */
type EpisodeField = 'image' | 'description' | 'duration' | 'releaseDate'

interface EpisodeRef {
  seasonNumber: number
  episodeNumber: number
}

interface SyncSeasonsResult {
  seasonsCreated: { seasonNumber: number; episodeCount: number }[]
  /** 既存シーズンに足したエピソード。新規シーズンに含まれる分は seasonsCreated 側で数える */
  episodesCreated: EpisodeRef[]
  episodesUpdated: (EpisodeRef & { fields: EpisodeField[] })[]
  /** 新規に入った / URL が変わったエピソード画像。warm は呼び出し元 (Queue consumer) が行う */
  newImageUrls: string[]
}

/**
 * 話数の並びを「S1 E5–7, 9 / S2 E1」の形に畳む。行数が膨らまないよう、
 * エピソード単位ではなく作品単位 1 行にまとめて残すための表示用文字列。
 */
export function formatEpisodeRefs(refs: EpisodeRef[]): string {
  const bySeason = new Map<number, number[]>()
  for (const r of refs) {
    const eps = bySeason.get(r.seasonNumber)
    if (eps) eps.push(r.episodeNumber)
    else bySeason.set(r.seasonNumber, [r.episodeNumber])
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, eps]) => {
      const sorted = [...new Set(eps)].sort((a, b) => a - b)
      const ranges: string[] = []
      let start = sorted[0]
      let prev = sorted[0]
      for (const n of [...sorted.slice(1), Number.NaN]) {
        if (n === prev + 1) {
          prev = n
          continue
        }
        ranges.push(start === prev ? `${start}` : `${start}–${prev}`)
        start = n
        prev = n
      }
      return `S${season} E${ranges.join(', ')}`
    })
    .join(' / ')
}

function toCatalogEvents(
  anime: { id: string; provider: string; contentId: string; title: string },
  stats: SyncSeasonsResult
): CatalogEventInput[] {
  const base = { animeId: anime.id, provider: anime.provider, contentId: anime.contentId, title: anime.title }
  const events: CatalogEventInput[] = stats.seasonsCreated.map((s) => ({
    ...base,
    kind: 'season-added',
    seasonNumber: s.seasonNumber,
    episodeCount: s.episodeCount
  }))
  if (stats.episodesCreated.length > 0) {
    events.push({
      ...base,
      kind: 'episodes-added',
      episodeCount: stats.episodesCreated.length,
      episodes: formatEpisodeRefs(stats.episodesCreated)
    })
  }
  if (stats.episodesUpdated.length > 0) {
    events.push({
      ...base,
      kind: 'episodes-updated',
      episodeCount: stats.episodesUpdated.length,
      episodes: formatEpisodeRefs(stats.episodesUpdated),
      fields: [...new Set(stats.episodesUpdated.flatMap((e) => e.fields))]
    })
  }
  return events
}

export class SyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly lambda: FetchClient
  ) {}

  /**
   * プロバイダのエピソード情報を取得し、不足しているシーズン・エピソードを同期する。
   * 戻り値は今回新規に入った / URL が変わったエピソード画像。warm するかどうかは呼び出し元 (Queue consumer) の責務。
   */
  async update({ message }: UpdateMessage): Promise<string[]> {
    // Lambda 経由で取得（画像の R2 アップロードも Lambda 側で実行される）
    const detail = await this.lambda.fetchTitleInfo({ provider: message.provider, contentId: message.contentId })
    return this.applyDetail(message.provider, message.contentId, detail)
  }

  /** 取得済みの TitleInfo を DB に反映する（Lambda 不要）。戻り値は新規画像 URL。 */
  async applyDetail(provider: string, contentId: string, detail: TitleInfo): Promise<string[]> {
    const anime = await withD1Retry(() =>
      this.prisma.anime.update({
        where: { provider_contentId: { provider, contentId } },
        data: { description: detail.description }
      })
    )

    const stats = await this.syncSeasons(anime.id, provider, contentId, detail.seasons)
    await recordCatalogEvents(this.prisma, toCatalogEvents(anime, stats))

    syncLogger.info({
      action: 'apply-detail-done',
      provider,
      contentId,
      seasonCount: detail.seasons.length,
      episodeCount: detail.seasons.reduce((sum, s) => sum + s.episodes.length, 0),
      seasonsCreated: stats.seasonsCreated.length,
      episodesCreated: stats.episodesCreated.length,
      episodesUpdated: stats.episodesUpdated.length
    })

    return stats.newImageUrls
  }

  /** 既存シーズン・エピソードと差分比較し、不足分を追加する */
  private async syncSeasons(
    animeId: string,
    provider: string,
    contentId: string,
    seasons: Season[]
  ): Promise<SyncSeasonsResult> {
    const stats: Omit<SyncSeasonsResult, 'newImageUrls'> = {
      seasonsCreated: [],
      episodesCreated: [],
      episodesUpdated: []
    }
    /** 新規に入った / URL が変わったエピソード画像。D1 書き込みが全部通った後に warm する */
    const newImageUrls: string[] = []
    const anime = await this.prisma.anime.findUniqueOrThrow({
      where: { provider_contentId: { provider, contentId } },
      include: {
        seasons: {
          include: {
            episodes: {
              select: {
                id: true,
                episodeNumber: true,
                imageUrl: true,
                description: true,
                duration: true,
                releaseDate: true
              }
            }
          }
        }
      }
    })

    const existingSeasons = new Map(
      anime.seasons.map((s) => [
        s.seasonNumber,
        new Map(
          s.episodes.map((e) => [
            e.episodeNumber,
            {
              id: e.id,
              imageUrl: e.imageUrl,
              description: e.description,
              duration: e.duration,
              releaseDate: e.releaseDate
            }
          ])
        )
      ])
    )

    for (const season of seasons) {
      const existingEpisodes = existingSeasons.get(season.seasonNumber)

      if (!existingEpisodes) {
        try {
          await withD1Retry(() => this.createSeason(animeId, provider, contentId, season))
          stats.seasonsCreated.push({ seasonNumber: season.seasonNumber, episodeCount: season.episodes.length })
          newImageUrls.push(...season.episodes.map((e) => e.imageUrl))
          syncLogger.info({
            action: 'create-season',
            provider,
            contentId,
            seasonNumber: season.seasonNumber,
            displayName: season.displayName,
            episodeCount: season.episodes.length
          })
        } catch (e) {
          if (!isUniqueConstraintError(e)) throw e
          syncLogger.warn({ action: 'create-season-duplicate', provider, contentId, seasonId: season.seasonId })
        }
        continue
      }

      const dbSeason = anime.seasons.find((s) => s.seasonNumber === season.seasonNumber)
      if (!dbSeason) continue

      // 既存シーズンへの追加/更新は意図的に1件ずつ行っている
      // (episode.createMany や raw env.DB.batch() への置き換えは実測のうえ不採用とした)。
      //   - 新規追加: createMany は @prisma/adapter-d1 内部で自動チャンク (実測 6 行/statement、
      //     MAX_BIND_VALUES=98 ÷ Episode 15 列) され round trip 数自体は減る。ただし skipDuplicates は
      //     sqlite/D1 provider が未対応で使えず、チャンクに1件でも重複行が混じると P2002 で createMany 全体が
      //     中断する。さらに実測では、どのチャンクが失敗するかは投入順と一致しない(重複行を含むチャンクではなく
      //     別のチャンクが先に失敗した例を確認済み)ため、中断後にどこまでコミット済みかを呼び出し側から
      //     予測できない。現行の1件ずつ catch-and-skip (P2002 は無視して続行) の方が再実行時の安全性が高い。
      //   - 更新: UPDATE は行ごとに SET 値が異なり Prisma 経由では束ねられない。束ねるには raw SQL で
      //     env.DB.batch() を書く必要があり、型安全性を失う割に1 sync あたりの変更行数は通常少なく効果は薄い。
      // そもそも D1 はトランザクション未対応 (`Cloudflare D1 does not support transactions yet`) で、
      // 束ねた書き込みを「全部成功/全部失敗」として安全に扱う土台がない。
      for (const episode of season.episodes) {
        const existing = existingEpisodes.get(episode.episodeNumber)
        if (!existing) {
          try {
            await withD1Retry(() => this.createEpisode(dbSeason.id, provider, contentId, dbSeason.seasonId, episode))
            stats.episodesCreated.push({ seasonNumber: season.seasonNumber, episodeNumber: episode.episodeNumber })
            newImageUrls.push(episode.imageUrl)
          } catch (e) {
            if (!isUniqueConstraintError(e)) throw e
          }
          continue
        }
        const nextReleaseDate = dayjs(episode.releaseDate).toDate()
        const fields: EpisodeField[] = []
        if (existing.imageUrl !== episode.imageUrl) fields.push('image')
        if (existing.description !== episode.description) fields.push('description')
        if (existing.duration !== episode.duration) fields.push('duration')
        if (existing.releaseDate.getTime() !== nextReleaseDate.getTime()) fields.push('releaseDate')
        if (fields.length > 0) {
          await withD1Retry(() =>
            this.prisma.episode.update({
              where: { id: existing.id },
              data: {
                imageUrl: episode.imageUrl,
                description: episode.description,
                duration: episode.duration,
                releaseDate: nextReleaseDate
              }
            })
          )
          stats.episodesUpdated.push({
            seasonNumber: season.seasonNumber,
            episodeNumber: episode.episodeNumber,
            fields
          })
          if (existing.imageUrl !== episode.imageUrl) newImageUrls.push(episode.imageUrl)
        }
      }
    }

    return { ...stats, newImageUrls }
  }

  /**
   * シーズンをエピソード込みで一括作成する。
   * episodes: { create: [...] } は createMany と同じ仕組みで Prisma が自動的に複数行 INSERT へ
   * チャンクする (実測: 13件 → 6+6+1件の3 INSERT)。ここは既に round trip 最小化済みのため変更不要。
   */
  private async createSeason(animeId: string, provider: string, contentId: string, season: Season): Promise<void> {
    await this.prisma.season.create({
      data: {
        id: seasonUuid(provider, contentId, season.seasonId),
        animeId,
        seasonId: season.seasonId,
        displayName: season.displayName,
        seasonNumber: season.seasonNumber,
        episodes: {
          create: season.episodes.map((episode) => ({
            id: episodeUuid(provider, contentId, season.seasonId, episode.episodeNumber),
            episodeNumber: episode.episodeNumber,
            episodeId: episode.episodeId,
            title: episode.title,
            description: episode.description,
            releaseDate: dayjs(episode.releaseDate).toDate(),
            duration: episode.duration,
            maturityRating: episode.maturityRating,
            imageUrl: episode.imageUrl,
            hasSubtitles: episode.hasSubtitles,
            hasDub: episode.hasDub,
            benefitId: episode.benefitId
          }))
        }
      }
    })
  }

  /** 既存シーズンに不足エピソードを1件追加する */
  private async createEpisode(
    seasonDbId: string,
    provider: string,
    contentId: string,
    seasonStableId: string,
    episode: Episode
  ): Promise<void> {
    await this.prisma.episode.create({
      data: {
        id: episodeUuid(provider, contentId, seasonStableId, episode.episodeNumber),
        seasonId: seasonDbId,
        episodeNumber: episode.episodeNumber,
        episodeId: episode.episodeId,
        title: episode.title,
        description: episode.description,
        releaseDate: dayjs(episode.releaseDate).toDate(),
        duration: episode.duration,
        maturityRating: episode.maturityRating,
        imageUrl: episode.imageUrl,
        hasSubtitles: episode.hasSubtitles,
        hasDub: episode.hasDub,
        benefitId: episode.benefitId
      }
    })
  }

  /** プロバイダからタイトル一覧を取得し、更新対象のコンテンツIDを返す */
  async fetch({ message }: FetchMessage): Promise<string[]> {
    fetchLogger.info({
      action: 'fetch-start',
      provider: message.provider,
      category: message.category
    })
    if (message.category === 'expiring') {
      const result = await this.lambda.fetchExpiring({ provider: message.provider })
      return fetchExpiring(this.prisma, message.provider, result)
    }
    const result = await this.lambda.fetchTitleList({
      provider: message.provider,
      category: message.category
    })
    return fetchTitleList(this.prisma, message.provider, message.category, result)
  }
}
