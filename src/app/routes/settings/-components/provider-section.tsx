import { useQuery } from '@tanstack/react-query'
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
  if (isPending) return <span className='tabular-nums'>— 作品</span>
  if (isError) return <span>作品数を取得できない</span>
  return (
    <span className='tabular-nums'>
      {data.total.toLocaleString('ja-JP')} 作品
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

  return (
    <PgSec
      id='s-provider'
      title='配信プロバイダ'
      count={
        <>
          {enabled} / {PROVIDER_KEYS.length} 有効
        </>
      }
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
              tag={unlinked ? '未連携' : undefined}
              description={unlinked ? 'カタログの取得がまだ設定されていない。' : <ProviderCount provider={provider} />}
            >
              <StSwitch
                label={`${providerLabel[provider] ?? provider} を表示`}
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
          label='既定のクール'
          description='ホームの「今期アニメ」と一覧の初期フィルタに使われる。'
        >
          <StSegment
            label='既定のクール'
            value={settings.seasonPin === null ? 'follow' : 'pinned'}
            options={[
              { value: 'follow', label: '今期に追従' },
              { value: 'pinned', label: formatSeason(pinned) }
            ]}
            onValueChange={(next) => update('seasonPin', next === 'follow' ? null : currentSeason())}
          />
        </StRow>
      </StPanel>
    </PgSec>
  )
}
