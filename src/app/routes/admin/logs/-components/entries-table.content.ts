import { type Dictionary, t } from 'intlayer'

const adminLogsEntriesTableContent = {
  key: 'admin-logs-entries-table',
  content: t({
    ja: {
      headers: {
        time: '時刻',
        level: 'レベル',
        category: 'カテゴリ',
        action: 'イベント',
        content: '内容'
      },
      run: '詳細'
    },
    en: {
      headers: {
        time: 'Time',
        level: 'Level',
        category: 'Category',
        action: 'Event',
        content: 'Content'
      },
      run: 'Details'
    }
  })
} satisfies Dictionary

export default adminLogsEntriesTableContent
