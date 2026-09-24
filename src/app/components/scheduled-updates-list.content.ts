import { type Dictionary, insert, t } from 'intlayer'

const scheduledUpdatesListContent = {
  key: 'scheduled-updates-list',
  content: t({
    ja: {
      relative: {
        justNow: 'たった今',
        minutesAgo: insert('{{minutes}} 分前'),
        hoursAgo: insert('{{hours}} 時間前'),
        yesterday: '昨日',
        daysAgo: insert('{{days}} 日前')
      },
      empty: {
        message: '録画予約中の作品はまだありません。',
        cta: 'アニメ一覧から予約する'
      },
      heading: '録画予約中の更新',
      viewAll: '録画一覧へ',
      recorded: '録画済み',
      unrecorded: '未録画',
      expiring: '配信終了予定'
    }
  })
} satisfies Dictionary

export default scheduledUpdatesListContent
