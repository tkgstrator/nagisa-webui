/**
 * `/expiring` ハンドラ。
 * provider から「配信終了間近」タイトル一覧を取り、JST 日次境界に丸めた expiredAt を付けて返す。
 */
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { ExpiringResponse } from '../../../src/schemas/lambda.dto'
import { logger } from '../logger'
import { getProvider, type ProviderName } from '../provider'

// utcOffset(9) を setter として使うために utc plugin が必要。このハンドラだけが利用する。
dayjs.extend(utc)

/**
 * 指定 provider の「配信終了間近」タイトル一覧を取得し、
 * 各エントリの expiredAt を JST 日次境界の ISO 文字列に丸めて返す。
 *
 * @param provider  対象 provider 名 (hulu / crunchyroll / abema / amazon)
 * @returns fetchedAt と entries の pair
 */
export async function fetchExpiring(provider: ProviderName): Promise<ExpiringResponse> {
  const p = getProvider(provider)
  const titles = await p.fetchTitleList({ category: 'expiring' })

  const now = dayjs()
  const entries = titles.flatMap((t) => {
    if (!t.expiring) return []
    const expiredAt = now.add(t.expiring.remainingHours, 'hour').utcOffset(9).startOf('day').toISOString()
    return [{ contentId: t.contentId, expiredAt, expiringSeason: t.expiring.season }]
  })

  logger.info({ action: 'fetch-expiring', provider, count: entries.length })
  return { fetchedAt: now.toISOString(), entries }
}
