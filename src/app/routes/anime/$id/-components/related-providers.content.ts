import { type Dictionary, insert, t } from 'intlayer'

const relatedProvidersContent = {
  key: 'anime-id-related-providers',
  content: t({
    ja: {
      heading: '他の配信元',
      loading: '読み込み中',
      yearWithQuarter: insert('{{year}}年 {{quarter}}'),
      expiring: insert('{{date}} 終了'),
      empty: '他の配信元は見つかりませんでした'
    },
    en: {
      heading: 'Other providers',
      loading: 'Loading',
      yearWithQuarter: insert('{{quarter}} {{year}}'),
      expiring: insert('Available until {{date}}'),
      empty: 'No other providers found'
    }
  })
} satisfies Dictionary

export default relatedProvidersContent
