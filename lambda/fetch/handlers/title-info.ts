/**
 * `/title_info` ハンドラ。
 * provider の contentId に対応する詳細情報 (season / episode 構造) を取得する。
 */
import type { TitleInfo } from '../../../src/schemas/providers/common.dto'
import { logger } from '../logger'
import { getProvider } from '../provider'

/**
 * 指定 provider の contentId に対応する詳細情報 (season / episode 構造) を取得する。
 *
 * @param providerName  対象 provider 名 (request schema が string 受けのため enum に絞らない)
 * @param contentId     provider 側の content 識別子
 * @returns Provider が返した title 詳細をそのまま返す
 */
export async function fetchTitleInfo(providerName: string, contentId: string): Promise<TitleInfo> {
  const provider = getProvider(providerName)
  const detail = await provider.fetchTitleInfo(contentId)

  logger.info({
    action: 'fetch-title-info',
    provider: providerName,
    contentId,
    seasonCount: detail.seasons.length
  })
  return detail
}
