import { type Dictionary, insert, t } from 'intlayer'

const providerSectionContent = {
  key: 'settings-provider-section',
  content: t({
    ja: {
      title: '配信元',
      enabledCount: insert('{{enabled}} / {{total}} 有効'),
      count: {
        pending: '— 作品',
        error: '作品数を取得できません',
        label: insert('{{count}} 作品')
      },
      unlinkedDescription: 'まだ対応していません。',
      switchLabel: insert('{{provider}} を表示'),
      season: {
        label: '既定のクール',
        description: 'ホームの「今期アニメ」と一覧の初期絞り込み条件に使用します。',
        follow: '今期に合わせる'
      }
    },
    en: {
      title: 'Providers',
      enabledCount: insert('{{enabled}} / {{total}} enabled'),
      count: {
        pending: '— titles',
        error: 'Could not load the title count',
        label: insert('{{count}} titles')
      },
      unlinkedDescription: 'Not supported yet.',
      switchLabel: insert('Show {{provider}}'),
      season: {
        label: 'Default season',
        description: "Used for This season on the home page and the catalog's default filters.",
        follow: 'Follow the current season'
      }
    }
  })
} satisfies Dictionary

export default providerSectionContent
