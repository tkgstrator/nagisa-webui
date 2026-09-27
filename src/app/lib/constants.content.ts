import { type Dictionary, t } from 'intlayer'

const constantsContent = {
  key: 'constants',
  content: t({
    ja: {
      provider: {
        amazon: 'Prime Video',
        hulu: 'Hulu',
        crunchyroll: 'Crunchyroll',
        abema: 'ABEMA',
        netflix: 'Netflix'
      },
      status: {
        FINISHED: '完結',
        RELEASING: '放送中',
        NOT_YET_RELEASED: '未放送',
        CANCELLED: '中止',
        HIATUS: '休止'
      },
      recordStatusLabel: {
        none: '未リクエスト',
        pending: '待機中',
        downloading: 'ダウンロード中',
        completed: '録画済み',
        failed: '失敗',
        stale: '追跡不能',
        missing: 'ファイルなし'
      },
      recordStatusNote: {
        none: '録画リクエストは送信されていません',
        pending: 'リクエストは受け付けられ、キューで待機中です',
        downloading: 'キューで実行中です',
        completed: '録画台帳でファイルの存在を確認済みです',
        failed: 'キューのジョブが失敗しました',
        stale: '30 分間キューで確認できていません（失敗とは限りません）',
        missing: '録画台帳からファイル情報が削除されました'
      }
    },
    en: {
      provider: {
        amazon: 'Prime Video',
        hulu: 'Hulu',
        crunchyroll: 'Crunchyroll',
        abema: 'ABEMA',
        netflix: 'Netflix'
      },
      status: {
        FINISHED: 'Finished',
        RELEASING: 'Airing',
        NOT_YET_RELEASED: 'Not yet aired',
        CANCELLED: 'Cancelled',
        HIATUS: 'On hiatus'
      },
      recordStatusLabel: {
        none: 'Not requested',
        pending: 'Pending',
        downloading: 'Downloading',
        completed: 'Recorded',
        failed: 'Failed',
        stale: 'Tracking lost',
        missing: 'File missing'
      },
      recordStatusNote: {
        none: 'No recording request has been sent',
        pending: 'Request accepted and waiting in the queue',
        downloading: 'Job is running in the queue',
        completed: 'Recording file confirmed in the library',
        failed: 'The queued job failed',
        stale: 'Not seen in the queue for 30 minutes; this does not necessarily mean failure',
        missing: 'Recording file is no longer listed in the library'
      }
    }
  })
} satisfies Dictionary

export default constantsContent
