import { type Dictionary, insert, t } from 'intlayer'

const adminLogsContent = {
  key: 'admin-logs',
  content: t({
    ja: {
      common: {
        all: 'すべて'
      },
      filters: {
        period: '期間',
        kind: '種別',
        status: '状態',
        level: 'レベル',
        result: '結果'
      },
      options: {
        hours: {
          h24: '直近 24 時間',
          h72: '直近 3 日',
          h168: '直近 7 日',
          h336: '直近 14 日',
          h720: '直近 30 日',
          h2160: '直近 90 日',
          h4320: '直近 180 日'
        },
        level: {
          infoAndAbove: insert('{{label}} 以上 (すべて)'),
          andAbove: insert('{{label}} 以上'),
          onlyLabel: insert('{{label}} のみ')
        }
      },
      search: {
        placeholder: '本文で検索',
        ariaLabel: 'ログ本文で検索'
      },
      page: {
        title: '同期ログ',
        description: 'cron / Queue バッチ / 手動実行の履歴と、Worker の生ログ、録画リクエストの結果'
      },
      stats: {
        unavailable: '集計を取得できませんでした',
        ariaLabel: '直近 24 時間の実行',
        unit: '件',
        total: { label: '実行', note: '直近 24 時間' },
        success: { label: '成功', note: '全件処理できた実行' },
        partial: { label: '一部失敗', note: '一部のジョブが落ちた実行' },
        failed: { label: '失敗', note: insert('実行中 {{count}} 件') }
      },
      tabs: {
        runs: '実行履歴',
        entries: '生ログ',
        recordings: '録画'
      },
      runsTab: {
        cronAriaLabel: 'cron の稼働状況',
        cronHeading: 'cron の稼働状況',
        sectionAriaLabel: '実行履歴',
        heading: insert('実行履歴 ({{count}} 件)'),
        empty: '該当する実行はありません'
      },
      entriesTab: {
        heading: '生ログ',
        empty: '該当するログはありません',
        loading: '読み込み中…',
        loadMore: 'さらに読み込む',
        noMore: 'これ以上ありません'
      },
      recordingsTab: {
        heading: insert('録画イベント ({{count}} 件)'),
        empty: 'この期間の録画イベントはありません'
      }
    }
  })
} satisfies Dictionary

export default adminLogsContent
