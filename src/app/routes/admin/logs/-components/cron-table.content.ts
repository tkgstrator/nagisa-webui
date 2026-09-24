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
        duration: '所要'
      },
      neverRun: '一度も実行されていない',
      succeededFailed: insert('成功 {{succeeded}} / 失敗 {{failed}}')
    }
  })
} satisfies Dictionary

export default adminLogsCronTableContent
