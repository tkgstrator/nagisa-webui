import { type Dictionary, insert, t } from 'intlayer'

const providerSectionContent = {
  key: 'settings-provider-section',
  content: t({
    ja: {
      title: '配信プロバイダ',
      enabledCount: insert('{{enabled}} / {{total}} 有効'),
      count: {
        pending: '— 作品',
        error: '作品数を取得できない',
        label: insert('{{count}} 作品')
      },
      unlinkedTag: '未連携',
      unlinkedDescription: 'カタログの取得がまだ設定されていない。',
      switchLabel: insert('{{provider}} を表示'),
      season: {
        label: '既定のクール',
        description: 'ホームの「今期アニメ」と一覧の初期フィルタに使われる。',
        follow: '今期に追従'
      }
    }
  })
} satisfies Dictionary

export default providerSectionContent
