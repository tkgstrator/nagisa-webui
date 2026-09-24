import { type Dictionary, insert, t } from 'intlayer'

const serverStatusDialogContent = {
  key: 'server-status-dialog',
  content: t({
    ja: {
      time: {
        seconds: insert('{{count}} 秒'),
        minutes: insert('{{count}} 分'),
        ago: insert('{{span}}前'),
        stopped: insert('{{span}} 停止'),
        notRun: '未実行'
      },
      episode: {
        single: insert('第 {{episode}} 話'),
        multiple: insert('{{count}} 話')
      },
      activeJob: {
        startedAt: insert('{{stamp}} 開始'),
        pending: '進捗待ち'
      },
      failedJob: {
        finishedAt: insert('{{stamp}} 終了'),
        queuedAt: insert('{{stamp}} 投入')
      },
      jobSync: {
        label: 'ジョブ同期',
        untracked: '追跡対象なし'
      },
      syncSection: {
        title: '録画同期',
        note: 'Workers 側 cron',
        library: 'ライブラリ同期',
        pendingLabel: '反映待ち',
        pendingValue: insert('{{count}} 件 (録画中)'),
        importLabel: '取り込み',
        importValue: '全件を取り込み中',
        startedLabel: '開始',
        bootstrapNote:
          'サーバー交換後の初回のみ全件を取り込みます。完了するまで一部の録画が「未確認」のままになります。'
      },
      detailLink: {
        title: '詳細とリソース',
        subtitle: 'Redis · CPU · 台帳 · 同期ロック'
      },
      onlineBody: {
        uptime: insert('稼働 {{uptime}}'),
        lastFailed: insert('直近の失敗 {{span}}前'),
        processing: insert('{{count}} 件を処理中'),
        importing: '台帳を取り込み中',
        lastResponded: insert('最終応答 {{span}}前'),
        versionRecommend: insert('v{{version}} 以上を推奨'),
        queueHeading: 'キュー',
        queueNote: 'nagisa の保持分',
        queue: {
          wait: '待機',
          active: '実行中',
          completed: '完了',
          failed: '失敗',
          delayed: '遅延'
        },
        noActiveJobs: '実行中のジョブはありません。',
        queueUnavailable: 'キューの状態を取得できません (Redis 未接続)。',
        activeJobsHeading: '実行中のジョブ',
        failedJobsHeading: '失敗したジョブ',
        countUnit: insert('{{count}} 件'),
        failedJobsNoteTruncated: insert('{{total}} 件中 {{shown}} 件')
      },
      offlineBody: {
        title: 'オフライン',
        detail: '録画サーバーに接続できません',
        lastRespondedLabel: '最終応答',
        notConnected: '未接続'
      },
      statusBody: {
        connectingTitle: '接続しています',
        connectingDetail: '録画サーバーの状態を取得中'
      }
    }
  })
} satisfies Dictionary

export default serverStatusDialogContent
