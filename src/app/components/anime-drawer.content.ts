import { type Dictionary, insert, t } from 'intlayer'

const animeDrawerContent = {
  key: 'anime-drawer',
  content: t({
    ja: {
      loading: '読み込み中…',
      description: insert('{{title}} の詳細'),
      yearSuffix: '年',
      schedule: {
        scheduled: '予約済み',
        unscheduled: '予約'
      },
      record: {
        recorded: '録画済み',
        unrecorded: '録画'
      },
      refresh: {
        ariaLabel: 'タイトル情報を再取得'
      },
      toasts: {
        recordNoEpisodes: '録画対象のエピソードがありません',
        recordStarted: '録画を開始しました',
        recordFailed: '録画リクエストに失敗しました',
        refreshPartialFailure: 'タイトル情報は更新しましたが、録画状態の同期に失敗しました',
        refreshSuccess: 'タイトル情報と録画状態を更新しました',
        refreshFailedFallback: '情報の更新に失敗しました'
      },
      episodes: {
        count: insert('{{count}} 話'),
        previewHeading: insert('エピソード（先頭 {{count}} 話）'),
        more: insert('ほか {{count}} 件')
      },
      openFullPage: '詳細ページを開く',
      watchOn: insert('{{provider}} で見る')
    },
    en: {
      loading: 'Loading…',
      description: insert('Details for {{title}}'),
      yearSuffix: '',
      schedule: {
        scheduled: 'Scheduled',
        unscheduled: 'Schedule'
      },
      record: {
        recorded: 'Recorded',
        unrecorded: 'Record'
      },
      refresh: {
        ariaLabel: 'Refresh title information'
      },
      toasts: {
        recordNoEpisodes: 'No episodes available to record',
        recordStarted: 'Recording started',
        recordFailed: 'Failed to request recording',
        refreshPartialFailure: 'Title information updated, but recording status could not be synced',
        refreshSuccess: 'Title information and recording status updated',
        refreshFailedFallback: 'Failed to refresh information'
      },
      episodes: {
        count: insert('Episodes: {{count}}'),
        previewHeading: insert('Episodes (first {{count}})'),
        more: insert('{{count}} more')
      },
      openFullPage: 'Open full page',
      watchOn: insert('Watch on {{provider}}')
    }
  })
} satisfies Dictionary

export default animeDrawerContent
