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
        newEpisode: '新着',
        recentlyAdded: '新着追加',
        comingSoon: '配信予定',
        expiring: '配信終了予定'
      },
      expiresOn: insert('{{date}} まで'),
      updatesOn: insert('{{date}} 更新'),
      detailAriaLabel: insert('{{title}} の詳細')
    }
  })
} satisfies Dictionary

export default animeCardContent
