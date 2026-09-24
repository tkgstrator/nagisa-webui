import { useQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { animeListQueryOptions } from '@/app/lib/query-options'
import {
  currentSeason,
  formatSeason,
  PROVIDER_KEYS,
  type ProviderKey,
  UNLINKED_PROVIDERS,
  useSettings
} from '../-lib/settings'
import { StPanel, StRow, StSegment, StSwitch } from './controls'
import { SeasonIcon } from './icons'
import { PgSec } from './section'

/** プロバイダごとの登録作品数。件数だけ要るので limit=1 で total を引く。 */
const ProviderCount = ({ provider }: { provider: ProviderKey }) => {
  const { data, isPending, isError } = useQuery(animeListQueryOptions({ provider, page: 1, limit: 1 }))
  const content = useIntlayer('settings-provider-section')
  if (isPending) return <span className='tabular-nums'>{content.count.pending}</span>
  if (isError) return <span>{content.count.error}</span>
  return (
    <span className='tabular-nums'>
      {content.count.label({ count: data.total.toLocaleString('ja-JP') })}
      {/* TODO: 最終取得時刻を出す API が無いので件数だけにしている。 */}
    </span>
  )
}

const ProviderPill = ({ provider }: { provider: ProviderKey }) => (
  <span
    className={`inline-flex h-6 min-w-[108px] shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-bold ${
      providerColor[provider] ?? 'bg-secondary text-secondary-foreground'
    }`}
  >
    {providerLabel[provider] ?? provider}
  </span>
)

export const ProviderSection = () => {
  const { settings, update, setProvider } = useSettings()
  const enabled = PROVIDER_KEYS.filter((key) => settings.providers[key]).length
  const pinned = settings.seasonPin ?? currentSeason()
  const content = useIntlayer('settings-provider-section')

  return (
    <PgSec
      id='s-provider'
      title={content.title.value}
      count={content.enabledCount({ enabled, total: PROVIDER_KEYS.length })}
    >
      <StPanel>
        {/* TODO: browse の provider フィルタは単一選択のため、この有効・無効はまだ一覧に効かない。 */}
        {PROVIDER_KEYS.map((provider, index) => {
          const unlinked = UNLINKED_PROVIDERS.includes(provider)
          return (
            <StRow
              key={provider}
              index={index}
              badge={<ProviderPill provider={provider} />}
              tag={unlinked ? content.unlinkedTag.value : undefined}
              description={unlinked ? content.unlinkedDescription : <ProviderCount provider={provider} />}
            >
              <StSwitch
                label={content.switchLabel({ provider: providerLabel[provider] ?? provider }).value}
                checked={settings.providers[provider]}
                onCheckedChange={(next) => setProvider(provider, next)}
              />
            </StRow>
          )
        })}

        {/* ホームの見出しと一覧、browse の絞り込み初期値がこのクールに従う。 */}
        <StRow
          index={PROVIDER_KEYS.length}
          icon={<SeasonIcon />}
          label={content.season.label.value}
          description={content.season.description}
        >
          <StSegment
            label={content.season.label.value}
            value={settings.seasonPin === null ? 'follow' : 'pinned'}
            options={[
              { value: 'follow', label: content.season.follow.value },
              { value: 'pinned', label: formatSeason(pinned) }
            ]}
            onValueChange={(next) => update('seasonPin', next === 'follow' ? null : currentSeason())}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
