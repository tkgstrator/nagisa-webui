import { type Dictionary, insert, t } from 'intlayer'

const adminLogsRunIdContent = {
  key: 'admin-logs-run-id',
  content: t({
    ja: {
      fetchError: '実行記録を取得できませんでした',
      backLink: '同期ログ',
      stats: {
        ariaLabel: '件数',
        unit: '件',
        total: {
          label: '対象',
          note: 'この実行が扱った件数'
        },
        succeeded: {
          label: '成功',
          note: '正常に処理できた件数'
        },
        failed: {
          label: '失敗',
          note: 'エラーで処理に失敗した件数'
        },
        retried: {
          label: '再試行',
          note: 'キューへ戻した件数'
        }
      },
      detail: {
        ariaLabel: '実行の詳細',
        idLabel: 'ID',
        triggerLabel: 'トリガー',
        durationLabel: '所要時間',
        finishedLabel: '終了',
        notFinished: '未完了',
        animeLabel: '作品',
        animeSummary: insert('新規 {{created}} 件 · 更新 {{updated}} 件'),
        parentLabel: '親実行',
        errorLabel: 'エラー',
        metaLabel: 'メタデータ'
      },
      children: {
        ariaLabel: '子実行',
        heading: insert('子実行 ({{count}} 件)'),
        empty: 'この実行から投入されたバッチはまだありません'
      },
      entries: {
        ariaLabel: 'この実行のログ',
        heading: insert('ログ ({{count}} 件)'),
        empty: 'この実行のログは残っていません'
      }
    },
    en: {
      fetchError: 'Failed to load run details',
      backLink: 'Sync logs',
      stats: {
        ariaLabel: 'Count',
        unit: 'items',
        total: {
          label: 'Total',
          note: 'Items handled by this run'
        },
        succeeded: {
          label: 'Succeeded',
          note: 'Items processed successfully'
        },
        failed: {
          label: 'Failed',
          note: 'Items that failed'
        },
        retried: {
          label: 'Retry',
          note: 'Items returned to the queue'
        }
      },
      detail: {
        ariaLabel: 'Run details',
        idLabel: 'ID',
        triggerLabel: 'Trigger',
        durationLabel: 'Duration',
        finishedLabel: 'Finished at',
        notFinished: 'Not finished yet',
        animeLabel: 'titles',
        animeSummary: insert('Created: {{created}} · Updated: {{updated}}'),
        parentLabel: 'Parent run',
        errorLabel: 'Error',
        metaLabel: 'Metadata'
      },
      children: {
        ariaLabel: 'Child runs',
        heading: insert('Child runs ({{count}})'),
        empty: 'No batches have been queued by this run yet'
      },
      entries: {
        ariaLabel: 'Logs for this run',
        heading: insert('Logs ({{count}})'),
        empty: 'No logs remain for this run'
      }
    }
  })
} satisfies Dictionary

export default adminLogsRunIdContent
