/**
 * AniList anime media を 1 年単位で取得して D1 の anilist_media を Prisma 経由で upsert する。
 * Workers Queue consumer から年単位のメッセージで呼ばれる想定。
 */
import dayjs from 'dayjs'
import type { PrismaClient } from '../../generated/prisma/client.ts'
import type { FetchClient } from '../lambda'
import { getAppLogger } from '../logger'
import type { AniListEntry } from './anilist-fetch'
import { normalizeTitle } from './normalize'

const logger = getAppLogger('anilist-sync')

/** 1 年を取り切るまでの Lambda 呼び出し回数の上限 (1 回 5 ページ × 20 回 = 100 ページ) */
const MAX_CALLS = 20

export interface SyncYearOptions {
  prisma: PrismaClient
  lambda: Pick<FetchClient, 'fetchAnilistYear'>
  year: number
  country?: string
}

export interface SyncYearResult {
  year: number
  fetched: number
  pages: number
  elapsedMs: number
}

async function upsertEntry(prisma: PrismaClient, e: AniListEntry, country: string, syncedAt: Date): Promise<void> {
  const data = {
    titleNative: e.title.native,
    titleRomaji: e.title.romaji,
    titleEnglish: e.title.english,
    season: e.season,
    seasonYear: e.seasonYear,
    status: e.status ?? 'UNKNOWN',
    startYear: e.startDate.year,
    startMonth: e.startDate.month,
    countryOfOrigin: country,
    nativeNorm: normalizeTitle(e.title.native) || null,
    romajiNorm: normalizeTitle(e.title.romaji) || null,
    englishNorm: normalizeTitle(e.title.english) || null,
    syncedAt
  }
  await prisma.anilistMedia.upsert({
    where: { id: e.id },
    create: { id: e.id, ...data },
    update: data
  })
}

/**
 * 指定年の AniList anime を Lambda 経由で取得して anilist_media を upsert する。
 * Workers の送信元は AniList に 403 でブロックされるため、取得は Lambda に任せ、ここは upsert だけ行う。
 * Queue 1 メッセージ = 1 年。失敗時は Queue の retry に任せて再実行される（idempotent）。
 */
export async function syncAnilistMediaYear(options: SyncYearOptions): Promise<SyncYearResult> {
  const { prisma, lambda, year } = options
  const country = options.country ?? 'JP'
  const start = dayjs()

  logger.info({ action: 'sync-year-start', year, country })

  // 続きがある限り Lambda にページ範囲を頼む。1 年は約 10 ページなので数回で終わる。
  // 暴走防止に Lambda 呼び出しは MAX_CALLS 回まで。
  const state = { nextPage: 1 as number | null, fetched: 0, pages: 0 }
  for (const _ of Array.from({ length: MAX_CALLS })) {
    if (state.nextPage === null) break
    const chunk = await lambda.fetchAnilistYear({ year, country, startPage: state.nextPage })
    const syncedAt = dayjs().toDate()
    for (const e of chunk.entries) {
      await upsertEntry(prisma, e, country, syncedAt)
    }
    state.fetched += chunk.entries.length
    state.pages += chunk.pages
    state.nextPage = chunk.nextPage
  }
  if (state.nextPage !== null) {
    throw new Error(`AniList year ${year} did not finish within ${MAX_CALLS} Lambda calls (nextPage=${state.nextPage})`)
  }

  const elapsedMs = dayjs().diff(start, 'millisecond')
  logger.info({ action: 'sync-year-done', year, country, fetched: state.fetched, pages: state.pages, elapsedMs })
  return { year, fetched: state.fetched, pages: state.pages, elapsedMs }
}
