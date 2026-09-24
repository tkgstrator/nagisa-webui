import { type Dictionary, t } from 'intlayer'

const recordingStatusContent = {
  key: 'anime-id-recording-status',
  content: t({
    ja: {
      jobState: {
        active: '録画中',
        wait: '待機中',
        delayed: '再試行待ち',
        completed: '完了',
        failed: '失敗'
      },
      recordingsUnit: ' 本',
      queueUnavailable: 'キューを読めませんでした',
      loading: '読み込み中',
      fetchError: '録画サーバーに問い合わせできませんでした',
      empty: '録画サーバーにはまだ何もありません',
      heading: '録画サーバー'
    }
  })
} satisfies Dictionary

export default recordingStatusContent
