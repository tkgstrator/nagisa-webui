import { type Dictionary, t } from 'intlayer'

const browseFiltersContent = {
  key: 'browse-browse-filters',
  content: t({
    ja: {
      groups: {
        provider: '配信元',
        year: '年',
        quarter: 'クール',
        status: 'ステータス',
        badge: 'バッジ'
      },
      allYears: 'すべて',
      quarters: {
        winter: '冬',
        spring: '春',
        summer: '夏',
        autumn: '秋'
      },
      statuses: {
        releasing: '放送中',
        finished: '完結',
        notYetReleased: '未放送',
        hiatus: '休止',
        cancelled: '中止'
      },
      badges: {
        newEpisode: '新着エピソード',
        recentlyAdded: '新規追加',
        comingSoon: '配信予定',
        expiring: '配信終了予定'
      },
      reset: '絞り込みをリセット'
    },
    en: {
      groups: {
        provider: 'Provider',
        year: 'Year',
        quarter: 'Season',
        status: 'Status',
        badge: 'Badge'
      },
      allYears: 'All',
      quarters: {
        winter: 'Winter',
        spring: 'Spring',
        summer: 'Summer',
        autumn: 'Fall'
      },
      statuses: {
        releasing: 'Airing',
        finished: 'Finished',
        notYetReleased: 'Not yet aired',
        hiatus: 'On hiatus',
        cancelled: 'Cancelled'
      },
      badges: {
        newEpisode: 'New episodes',
        recentlyAdded: 'Recently added',
        comingSoon: 'Upcoming',
        expiring: 'Leaving soon'
      },
      reset: 'Reset filters'
    }
  })
} satisfies Dictionary

export default browseFiltersContent
