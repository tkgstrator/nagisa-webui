/**
 * カタログに入った変化 (新規タイトル / 新規シーズン / エピソード追加 / 既存エピソードの情報更新) を
 * `catalog_events` に残す。バッジや配信終了の出入りは毎時入れ替わるだけなので載せない。
 *
 * 行数を抑えるため、エピソードの追加・更新は 1 回の同期につき作品単位で 1 行にまとめる
 * (どの話かは `episodes` に「S1 E5–7, 9」の形で畳んで入れる)。
 *
 * **書き込みに失敗しても絶対に throw しない**。同期本体の副作用であって、
 * 履歴が残せなかったことで同期を落としてはいけない。
 */

import type { createPrismaClient } from './db'
import { currentStore } from './log-capture'
import { getAppLogger } from './logger'

const logger = getAppLogger('catalog-event')

type Prisma = ReturnType<typeof createPrismaClient>

export type CatalogEventKind = 'title-added' | 'season-added' | 'episodes-added' | 'episodes-updated'

/** 1 度に積める行数の上限。まとめ投入で D1 のクエリ数を食い潰さないための蓋。 */
const MAX_EVENTS_PER_CALL = 100

export interface CatalogEventInput {
  animeId: string
  provider: string
  contentId: string
  title: string
  kind: CatalogEventKind
  seasonNumber?: number | null
  episodeCount?: number | null
  episodes?: string | null
  fields?: string[] | null
}

function toRow(input: CatalogEventInput, runId: string | null) {
  return {
    animeId: input.animeId,
    provider: input.provider,
    contentId: input.contentId,
    title: input.title,
    kind: input.kind,
    seasonNumber: input.seasonNumber ?? null,
    episodeCount: input.episodeCount ?? null,
    episodes: input.episodes ?? null,
    fields: input.fields == null ? null : JSON.stringify(input.fields),
    runId
  }
}

/** まとめて記録する。書けなければ warn に落として握り潰す。 */
export async function recordCatalogEvents(prisma: Prisma, inputs: CatalogEventInput[]): Promise<void> {
  if (inputs.length === 0) return
  const runId = currentStore()?.runId ?? null
  const rows = inputs.slice(0, MAX_EVENTS_PER_CALL).map((i) => toRow(i, runId))
  try {
    await prisma.catalogEvent.createMany({ data: rows })
  } catch (e) {
    logger.warn({
      action: 'catalog-event-write-failed',
      count: rows.length,
      error: e instanceof Error ? e.message : String(e)
    })
  }
}
