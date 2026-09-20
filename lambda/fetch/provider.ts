/**
 * provider 名 → Provider 実装のマッピング。
 * ルート層はこの factory を経由することで具象クラスの import を持たずに済む。
 */
import type { z } from 'zod'
import { AbemaProvider } from '../../src/lib/providers/abema'
import { AmazonProvider } from '../../src/lib/providers/amazon'
import type { Provider } from '../../src/lib/providers/base'
import { CrunchyrollProvider } from '../../src/lib/providers/crunchyroll'
import { HuluProvider } from '../../src/lib/providers/hulu'
import type { ProviderSchema } from '../../src/schemas/lambda.dto'
import { logger } from './logger'

/** Lambda が受け付ける provider 名。`ProviderSchema` (lambda.dto) から導出する。 */
export type ProviderName = z.infer<typeof ProviderSchema>

/** provider 名 → Provider 実装の factory テーブル。 */
const PROVIDER_FACTORIES: Record<ProviderName, () => Provider> = {
  amazon: () => new AmazonProvider(),
  hulu: () => new HuluProvider(),
  crunchyroll: () => new CrunchyrollProvider(),
  abema: () => new AbemaProvider()
}

/** name が既知の provider 名かどうかの type predicate。 */
function isProviderName(name: string): name is ProviderName {
  return Object.hasOwn(PROVIDER_FACTORIES, name)
}

/**
 * provider 名から Provider 実装を返す。
 * `/title_info` の request schema は provider を enum ではなく string で受けるため、引数は string のまま。
 * 未知の provider が来た場合は warn ログを出しつつ fallback として AmazonProvider を返す
 * (歴史的経緯: 従来の behavior 維持のためデフォルトは Amazon)。
 */
export function getProvider(name: string): Provider {
  if (isProviderName(name)) return PROVIDER_FACTORIES[name]()
  logger.warn({ action: 'provider-fallback', name })
  return PROVIDER_FACTORIES.amazon()
}
