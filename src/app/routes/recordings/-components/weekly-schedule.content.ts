import { type Dictionary, insert, t } from 'intlayer'

const weeklyScheduleContent = {
  key: 'recordings-weekly-schedule',
  content: t({
    ja: {
      dayNames: ['月', '火', '水', '木', '金', '土', '日'],
      hiatusNote: '休止中',
      upcomingNote: insert('初回 {{date}}〜'),
      ariaLabel: '週間スケジュール',
      description: '曜日ごとの配信予定です。録画したい作品の管理は「一覧」から行ってください。',
      empty: '予定なし'
    }
  })
} satisfies Dictionary

export default weeklyScheduleContent
