import { type Dictionary, insert, t } from 'intlayer'

const adminLogsCronTableContent = {
  key: 'admin-logs-cron-table',
  content: t({
    ja: {
      headers: {
        schedule: 'スケジュール',
        cronExpr: 'cron 式',
        lastRun: '最終実行',
        result: '結果',
        duration: '所要時間'
      },
      neverRun: '未実行',
      succeededFailed: insert('成功 {{succeeded}} / 失敗 {{failed}}')
    },
    en: {
      headers: {
        schedule: 'Schedule',
        cronExpr: 'cron expression',
        lastRun: 'Last run',
        result: 'Result',
        duration: 'Duration'
      },
      neverRun: 'Never run',
      succeededFailed: insert('Succeeded: {{succeeded}} / Failed: {{failed}}')
    }
  })
} satisfies Dictionary

export default adminLogsCronTableContent
