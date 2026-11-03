import { useQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { appLocale } from '@/app/lib/locale'
import { jellyfinRefreshStateQueryOptions } from '@/app/lib/query-options'
import { StNote, StPanel, StRow, StTag } from './controls'
import { TransferIcon } from './icons'
import { PgSec } from './section'

const formatAt = (iso: string | null): string =>
  iso === null ? '—' : new Date(iso).toLocaleString(appLocale, { dateStyle: 'short', timeStyle: 'medium' })

/**
 * Jellyfin 自動更新の設定を **読み取り専用** で見せる。値の編集口は持たない
 * (設定は wrangler の vars / secret)。API キーは設定済みかどうかだけ。
 */
export const JellyfinSection = () => {
  const content = useIntlayer('settings-jellyfin-section')
  const { data } = useQuery(jellyfinRefreshStateQueryOptions())
  const rows = content.rows

  const stateText = !data
    ? content.none
    : data.consecutiveFailures > 0
      ? rows.state.failures({ count: data.consecutiveFailures, error: data.lastError ?? '—' })
      : data.pending
        ? rows.state.pending
        : data.lastSucceededAt
          ? rows.state.lastSucceeded({ at: formatAt(data.lastSucceededAt) })
          : rows.state.idle

  return (
    <PgSec id='s-jellyfin' title={content.title.value} count={content.count}>
      <StPanel>
        <StRow index={0} icon={<TransferIcon />} label={rows.status.label.value} description={rows.status.description}>
          <StTag>{data?.enabled ? content.enabled.value : content.disabled.value}</StTag>
        </StRow>
        <StRow index={1} icon={<TransferIcon />} label={rows.url.label.value}>
          <StNote>{data?.url ?? content.notConfigured}</StNote>
        </StRow>
        <StRow index={2} icon={<TransferIcon />} label={rows.apiKey.label.value} description={rows.apiKey.description}>
          <StTag>{data?.apiKeyConfigured ? content.configured.value : content.notConfigured.value}</StTag>
        </StRow>
        <StRow index={3} icon={<TransferIcon />} label={rows.timing.label.value} description={rows.timing.description}>
          <StNote>
            {data ? rows.timing.value({ settle: data.settleSeconds, maxWait: data.maxWaitSeconds }) : content.none}
          </StNote>
        </StRow>
        <StRow index={4} icon={<TransferIcon />} label={rows.state.label.value}>
          <StNote>{stateText}</StNote>
          {data?.nextAttemptAt && data.consecutiveFailures > 0 && (
            <StNote>{rows.state.nextAttempt({ at: formatAt(data.nextAttemptAt) })}</StNote>
          )}
        </StRow>
      </StPanel>
    </PgSec>
  )
}
