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
      heading: '録画予約中の作品の更新',
      viewAll: '録画一覧へ',
      recorded: '録画済み',
      unrecorded: '未録画',
      expiring: '配信終了予定'
    },
    en: {
      relative: {
        justNow: 'Just now',
        minutesAgo: insert('{{minutes}} min ago'),
        hoursAgo: insert('{{hours}} hr ago'),
        yesterday: 'Yesterday',
        daysAgo: insert('{{days}} d ago')
      },
      empty: {
        message: 'No anime scheduled for recording yet.',
        cta: 'Browse anime to schedule'
      },
      heading: 'Updates to scheduled anime',
      viewAll: 'View recordings',
      recorded: 'Recorded',
      unrecorded: 'Not recorded',
      expiring: 'Leaving soon'
    }
  })
} satisfies Dictionary

export default scheduledUpdatesListContent
