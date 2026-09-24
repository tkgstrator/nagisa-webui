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
        total: { label: '対象', note: 'この実行が扱った件数' },
        succeeded: { label: '成功', note: '正常に処理できた件数' },
        failed: { label: '失敗', note: 'エラーで落ちた件数' },
        retried: { label: '再試行', note: 'キューへ戻した件数' }
      },
      detail: {
        ariaLabel: '実行の詳細',
        idLabel: 'ID',
        triggerLabel: 'トリガー',
        durationLabel: '所要',
        finishedLabel: '終了',
        notFinished: 'まだ終わっていない',
        animeLabel: '作品',
        animeSummary: insert('新規 {{created}} 件 · 更新 {{updated}} 件'),
        parentLabel: '親の実行',
        errorLabel: 'エラー',
        metaLabel: 'メタ'
      },
      children: {
        ariaLabel: '子の実行',
        heading: insert('子の実行 ({{count}} 件)'),
        empty: 'この実行から投入されたバッチはまだありません'
      },
      entries: {
        ariaLabel: 'この実行のログ',
        heading: insert('ログ ({{count}} 件)'),
        fetchError: insert('Workers Logs から取得できませんでした: {{error}}'),
        empty: 'この実行のログは残っていません (Workers Logs の保持は 7 日)'
      }
    }
  })
} satisfies Dictionary

export default adminLogsRunIdContent
