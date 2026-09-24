import { type Dictionary, t } from 'intlayer'

const animeIdContent = {
  key: 'anime-id',
  content: t({
    ja: {
      breadcrumb: {
        ariaLabel: 'パス',
        browse: 'アニメ一覧'
      },
      toast: {
        noRecordableEpisodes: '録画対象のエピソードがありません',
        recordingStarted: '録画を開始しました',
        recordingRequestFailed: '録画リクエストに失敗しました',
        refreshedWithSyncError: 'タイトル情報は更新しましたが、録画状態の同期に失敗しました',
        refreshed: 'タイトル情報と録画状態を更新しました',
        refreshFailed: '情報の更新に失敗しました'
      }
    }
  })
} satisfies Dictionary

export default animeIdContent
