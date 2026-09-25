import { type Dictionary, t } from 'intlayer'

const adminLogsEntriesTableContent = {
  key: 'admin-logs-entries-table',
  content: t({
    ja: {
      headers: {
        time: '時刻',
        level: 'レベル',
        category: 'カテゴリ',
        action: 'アクション',
        content: '内容'
      },
      run: '実行'
    },
    en: {
      headers: {
        time: 'Time',
        level: 'Level',
        category: 'Category',
        action: 'Action',
        content: 'Content'
      },
      run: 'Run'
    }
  })
} satisfies Dictionary

export default adminLogsEntriesTableContent
