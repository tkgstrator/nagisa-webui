/**
 * 日本 IP が必要な fetch を代行する Lambda ハンドラ (entry point)。
 *
 * AWS Lambda (ap-northeast-1) で実行し、日本 IP からの fetch を保証する。
 * fetch → 整形 → レスポンスとして返す。KV/DB は触らない。
 *
 * パスベースルーティング:
 *   POST /expiring       — 配信終了間近タイトル取得
 *   POST /title_list     — 新着エピソード / 最近更新タイトル取得
 *   POST /title_info     — タイトル詳細取得
 *   POST /abema_archive  — ABEMA archive key/segment fetch
 *   POST /identify       — AniList でタイトルを検索して aniListId 等を返す
 *   POST /anilist_year   — AniList の 1 年分 anime media をページ範囲指定で取得
 *   POST /anilist_status — AniList の media を id_in で取得 (放送中ステータスの再取得)
 *   POST /image          — 画像を取得して WebP のラダー各幅に変換して返す
 *
 * 実処理は handlers/ 配下に分割している。このファイルは entry と routing のみ。
 */
import { setupLogger } from '../../src/lib/logger'
import {
  ExpiringResponseSchema,
  FetchAbemaArchiveRequestSchema,
  FetchAbemaArchiveResponseSchema,
  FetchAnilistStatusRequestSchema,
  FetchAnilistStatusResponseSchema,
  FetchAnilistYearRequestSchema,
  FetchAnilistYearResponseSchema,
  FetchExpiringRequestSchema,
  FetchImageRequestSchema,
  FetchImageResponseSchema,
  FetchTitleInfoRequestSchema,
  FetchTitleListRequestSchema,
  IdentifyRequestSchema,
  IdentifyResponseSchema,
  TitleListResponseSchema
} from '../../src/schemas/lambda.dto'
import { TitleInfoSchema } from '../../src/schemas/providers/common.dto'
import { parseEvent } from './event'
import { fetchAbemaArchives } from './handlers/abema-archive'
import { fetchAnilistStatus } from './handlers/anilist-status'
import { fetchAnilistYear } from './handlers/anilist-year'
import { fetchExpiring } from './handlers/expiring'
import { identifyTitles } from './handlers/identify'
import { fetchImages } from './handlers/image'
import { fetchTitleInfo } from './handlers/title-info'
import { fetchTitleList } from './handlers/title-list'
import { logger } from './logger'
import { fail, handleRoute, type LambdaResponse } from './response'

setupLogger()

/**
 * Lambda entry point。
 * event を parseEvent で正規化し、path でルーティングして各 fetch 関数に委譲する。
 * 400 (bad request) / 404 (unknown path) / 500 (unhandled error) / 502 (upstream error) を返し得る。
 */
export async function handler(event: unknown): Promise<LambdaResponse> {
  const parsed = parseEvent(event)
  const { path, requestId } = parsed

  logger.info({ action: 'request', path, requestId })

  if (!parsed.ok) return fail(400, 'Invalid JSON body')
  const { body } = parsed

  try {
    switch (path) {
      case '/expiring':
        return await handleRoute(body, FetchExpiringRequestSchema, ExpiringResponseSchema, ({ provider }) => {
          logger.debug({ action: 'route-expiring', provider, requestId })
          return fetchExpiring(provider)
        })
      case '/title_list':
        return await handleRoute(
          body,
          FetchTitleListRequestSchema,
          TitleListResponseSchema,
          ({ provider, category }) => {
            logger.debug({ action: 'route-title-list', provider, category, requestId })
            return fetchTitleList(provider, category)
          }
        )
      case '/title_info':
        return await handleRoute(body, FetchTitleInfoRequestSchema, TitleInfoSchema, ({ provider, contentId }) => {
          logger.debug({ action: 'route-title-info', provider, contentId, requestId })
          return fetchTitleInfo(provider, contentId)
        })
      case '/abema_archive':
        return await handleRoute(
          body,
          FetchAbemaArchiveRequestSchema,
          FetchAbemaArchiveResponseSchema,
          ({ programIds, targetHeight }) => {
            logger.debug({
              action: 'route-abema-archive',
              count: programIds.length,
              targetHeight: targetHeight ?? 0,
              requestId
            })
            return fetchAbemaArchives(programIds, targetHeight ?? 0)
          }
        )
      case '/identify':
        return await handleRoute(body, IdentifyRequestSchema, IdentifyResponseSchema, ({ titles }) => {
          logger.debug({ action: 'route-identify', count: titles.length, requestId })
          return identifyTitles(titles)
        })
      case '/anilist_year':
        return await handleRoute(body, FetchAnilistYearRequestSchema, FetchAnilistYearResponseSchema, (input) => {
          logger.debug({ action: 'route-anilist-year', year: input.year, startPage: input.startPage, requestId })
          return fetchAnilistYear(input)
        })
      case '/anilist_status':
        return await handleRoute(body, FetchAnilistStatusRequestSchema, FetchAnilistStatusResponseSchema, ({ ids }) => {
          logger.debug({ action: 'route-anilist-status', count: ids.length, requestId })
          return fetchAnilistStatus(ids)
        })
      case '/image':
        return await handleRoute(body, FetchImageRequestSchema, FetchImageResponseSchema, ({ urls }) => {
          logger.debug({ action: 'route-image', count: urls.length, requestId })
          return fetchImages(urls)
        })
      default:
        return fail(404, `Unknown path: ${path}`)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    logger.error({ action: 'unhandled-error', path, requestId, message, stack })
    return fail(500, message)
  }
}
