import { type Dictionary, insert, t } from 'intlayer'

const jellyfinSectionContent = {
  key: 'settings-jellyfin-section',
  content: t({
    ja: {
      title: 'Jellyfin 連携',
      count: '録画完了時のライブラリ自動更新（環境変数・読み取り専用）',
      enabled: '有効',
      disabled: '無効',
      configured: '設定済み',
      notConfigured: '未設定',
      none: '—',
      rows: {
        status: {
          label: '自動更新',
          description: 'JELLYFIN_URL と JELLYFIN_API_KEY が両方あるときだけ有効になります。値は環境変数で設定します。'
        },
        url: { label: 'JELLYFIN_URL' },
        apiKey: { label: 'JELLYFIN_API_KEY', description: 'secret のため値は表示しません。' },
        timing: {
          label: 'デバウンス',
          description: '録画完了が止まってから送るまでの静穏期間と、連続しても必ず送る最大待ち時間です。',
          value: insert('静穏 {{settle}} 秒 / 最大 {{maxWait}} 秒')
        },
        state: {
          label: '状態',
          pending: '更新待ち',
          idle: '待機中',
          lastSucceeded: insert('最終成功 {{at}}'),
          failures: insert('連続失敗 {{count}} 回（{{error}}）'),
          nextAttempt: insert('次回再試行 {{at}}')
        }
      }
    },
    en: {
      title: 'Jellyfin',
      count: 'Auto library refresh on recording completion (environment variables, read-only)',
      enabled: 'Enabled',
      disabled: 'Disabled',
      configured: 'Configured',
      notConfigured: 'Not set',
      none: '—',
      rows: {
        status: {
          label: 'Auto refresh',
          description:
            'Enabled only when both JELLYFIN_URL and JELLYFIN_API_KEY are set. Configure them as environment variables.'
        },
        url: { label: 'JELLYFIN_URL' },
        apiKey: { label: 'JELLYFIN_API_KEY', description: 'This is a secret, so its value is never shown.' },
        timing: {
          label: 'Debounce',
          description:
            'Quiet period after the last completed recording, and the maximum wait even if recordings keep finishing.',
          value: insert('Quiet {{settle}}s / max {{maxWait}}s')
        },
        state: {
          label: 'State',
          pending: 'Refresh pending',
          idle: 'Idle',
          lastSucceeded: insert('Last success {{at}}'),
          failures: insert('{{count}} consecutive failures ({{error}})'),
          nextAttempt: insert('Next retry {{at}}')
        }
      }
    }
  })
} satisfies Dictionary

export default jellyfinSectionContent
