import { type Dictionary, insert, t } from 'intlayer'

const relatedProvidersContent = {
  key: 'anime-id-related-providers',
  content: t({
    ja: {
      heading: '他の配信元',
      loading: '読み込み中',
      headers: {
        provider: '配信元',
        recorded: '録画'
      },
      yearWithQuarter: insert('{{year}}年 {{quarter}}'),
      expiring: insert('{{date}} 終了'),
      empty: '他の配信元は見つかりませんでした'
    }
  })
} satisfies Dictionary

export default relatedProvidersContent
