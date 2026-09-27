import { type Dictionary, t } from 'intlayer'

const adminLogsRunsTableContent = {
  key: 'admin-logs-runs-table',
  content: t({
    ja: {
      headers: {
        startedAt: '開始',
        kind: '種別',
        trigger: 'トリガー',
        status: '状態',
        total: '対象',
        succeeded: '成功',
        failed: '失敗',
        duration: '所要時間'
      },
      detail: '詳細'
    },
    en: {
      headers: {
        startedAt: 'Started at',
        kind: 'Type',
        trigger: 'Trigger',
        status: 'Status',
        total: 'Total',
        succeeded: 'Succeeded',
        failed: 'Failed',
        duration: 'Duration'
      },
      detail: 'Details'
    }
  })
} satisfies Dictionary

export default adminLogsRunsTableContent
