/**
 * `/title_list` ハンドラ。
 * provider の new_episode / coming_soon / catalog カテゴリのタイトル一覧を整形して返す。
 */
import dayjs from 'dayjs'
import type { z } from 'zod'
import type { TitleListCategorySchema, TitleListResponse } from '../../../src/schemas/lambda.dto'
import { logger } from '../logger'
import { getProvider, type ProviderName } from '../provider'

/** `/title_list` が受け付けるカテゴリ。`TitleListCategorySchema` (lambda.dto) から導出する。 */
type TitleListCategory = z.infer<typeof TitleListCategorySchema>

/**
 * 指定 provider / category の title 一覧を取得して整形する。
 * catalog は provider によっては全件走査を意味するため呼び出し側で頻度を制御すること。
 *
 * @param providerName  対象 provider 名
 * @param category      new_episode / coming_soon / catalog のいずれか
 * @returns fetchedAt と entries の pair
 */
export async function fetchTitleList(
  providerName: ProviderName,
  category: TitleListCategory
): Promise<TitleListResponse> {
  const provider = getProvider(providerName)
  const titles = await provider.fetchTitleList({ category })

  // expiring は `/expiring` 側の責務なので落とし、それ以外のフィールドはそのまま通す
  const entries = titles.map(({ expiring: _expiring, ...entry }) => entry)

  logger.info({
    action: 'fetch-title-list',
    provider: providerName,
    category,
    count: entries.length
  })
  return { fetchedAt: dayjs().toISOString(), entries }
}
