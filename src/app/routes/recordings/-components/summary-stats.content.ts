import { type Dictionary, insert, t } from 'intlayer'

const summaryStatsContent = {
  key: 'recordings-summary-stats',
  content: t({
    ja: {
      ariaLabel: '録画状況の概要',
      stats: {
        scheduled: '予約中',
        recordedVisible: '録画済み (表示中)',
        pendingVisible: '未録画 (表示中)',
        expiringVisible: '配信終了予定 (表示中)'
      },
      unit: '作品',
      recordedUnit: insert('/ {{visible}} 作品'),
      expiringUnitWithDays: insert('作品 · 最短 {{days}} 日')
    },
    en: {
      ariaLabel: 'Recording summary',
      stats: {
        scheduled: 'Scheduled',
        recordedVisible: 'Recorded (visible)',
        pendingVisible: 'Not recorded (visible)',
        expiringVisible: 'Leaving soon (visible)'
      },
      unit: 'titles',
      recordedUnit: insert('/ {{visible}} titles'),
      expiringUnitWithDays: insert('titles · Earliest in {{days}} d')
    }
  })
} satisfies Dictionary

export default summaryStatsContent
