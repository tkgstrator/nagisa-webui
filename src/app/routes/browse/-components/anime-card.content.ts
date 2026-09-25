import { type Dictionary, insert, t } from 'intlayer'

const animeCardContent = {
  key: 'browse-anime-card',
  content: t({
    ja: {
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
      expiresOn: insert('{{date}} まで'),
      updatesOn: insert('{{date}} 更新'),
      detailAriaLabel: insert('{{title}} の詳細')
    },
    en: {
      status: {
        releasing: 'Airing',
        finished: 'Finished',
        notYetReleased: 'Not yet aired',
        cancelled: 'Cancelled',
        hiatus: 'On hiatus'
      },
      badge: {
        newEpisode: 'New episode',
        recentlyAdded: 'Recently added',
        comingSoon: 'Upcoming',
        expiring: 'Leaving soon'
      },
      expiresOn: insert('Until {{date}}'),
      updatesOn: insert('Updated {{date}}'),
      detailAriaLabel: insert('Details for {{title}}')
    }
  })
} satisfies Dictionary

export default animeCardContent
