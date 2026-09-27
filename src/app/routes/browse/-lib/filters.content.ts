import { type Dictionary, t } from 'intlayer'

const browseFiltersLibContent = {
  key: 'browse-filters',
  content: t({
    ja: {
      quarters: {
        winter: '冬',
        spring: '春',
        summer: '夏',
        autumn: '秋'
      },
      status: {
        releasing: '放送中',
        finished: '完結',
        notYetReleased: '未放送',
        cancelled: '中止',
        hiatus: '休止'
      },
      badge: {
        newEpisode: '新着エピソード',
        recentlyAdded: '新規追加',
        comingSoon: '配信予定',
        expiring: '配信終了予定'
      },
      sort: {
        titleAsc: 'タイトル (昇順)',
        titleDesc: 'タイトル (降順)',
        yearDesc: '放送年 (新しい順)',
        yearAsc: '放送年 (古い順)'
      },
      chips: {
        provider: '配信元',
        year: '年',
        quarter: 'クール',
        status: 'ステータス',
        badge: 'バッジ',
        relatedSeries: '関連シリーズ',
        search: '検索'
      }
    },
    en: {
      quarters: {
        winter: 'Winter',
        spring: 'Spring',
        summer: 'Summer',
        autumn: 'Fall'
      },
      status: {
        releasing: 'Airing',
        finished: 'Finished',
        notYetReleased: 'Not yet aired',
        cancelled: 'Cancelled',
        hiatus: 'On hiatus'
      },
      badge: {
        newEpisode: 'New episodes',
        recentlyAdded: 'Recently added',
        comingSoon: 'Upcoming',
        expiring: 'Leaving soon'
      },
      sort: {
        titleAsc: 'Title (ascending)',
        titleDesc: 'Title (descending)',
        yearDesc: 'Release year (newest first)',
        yearAsc: 'Release year (oldest first)'
      },
      chips: {
        provider: 'Provider',
        year: 'Year',
        quarter: 'Season',
        status: 'Status',
        badge: 'Badge',
        relatedSeries: 'Related series',
        search: 'Search'
      }
    }
  })
} satisfies Dictionary

export default browseFiltersLibContent
