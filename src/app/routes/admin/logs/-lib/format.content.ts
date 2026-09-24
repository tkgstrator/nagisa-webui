import { type Dictionary, insert, t } from 'intlayer'

const adminLogsFormatContent = {
  key: 'admin-logs-format',
  content: t({
    ja: {
      runStatusLabel: {
        running: '実行中',
        success: '成功',
        partial: '一部失敗',
        failed: '失敗'
      },
      runKindLabel: {
        cron: 'Schedule',
        queue: 'Queue',
        manual: 'Manual'
      },
      logLevelLabel: {
        debug: 'DEBUG',
        info: 'INFO',
        warning: 'WARN',
        error: 'ERROR',
        fatal: 'FATAL'
      },
      recordingKindLabel: {
        request: '予約送信',
        status: '状態照会',
        recorded: '録画完了',
        notFound: '見つからない'
      },
      recordingSourceLabel: {
        ui: '画面',
        webhook: 'webhook',
        cron: 'cron'
      },
      recordingStatusLabel: {
        ok: '成功',
        error: '失敗'
      },
      cronLabels: {
        jobSync: '録画ジョブ追従',
        librarySync: '録画台帳の差分',
        hourly: '新着 / 配信予定',
        endingSoon: '配信終了間近',
        catalogFull: 'カタログ全件',
        abemaKeyArchive: 'ABEMA 鍵アーカイブ',
        aniListSync: 'AniList 同期'
      },
      day: {
        today: '今日',
        yesterday: '昨日'
      },
      duration: {
        seconds: insert('{{value}} 秒'),
        minutesSeconds: insert('{{minutes}} 分 {{seconds}} 秒')
      }
    }
  })
} satisfies Dictionary

export default adminLogsFormatContent
