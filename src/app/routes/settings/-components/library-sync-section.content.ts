import { type Dictionary, insert, t } from 'intlayer'

const librarySyncSectionContent = {
  key: 'settings-library-sync-section',
  content: t({
    ja: {
      title: '台帳同期',
      count: 'Nagisa の録画台帳を D1 に手動で同期します',
      row: {
        label: '台帳の全件同期',
        description:
          'Nagisa の録画台帳を D1 に手動で同期します。bootstrap が進行中でなければ、最初から取得し直します。',
        idleButton: '今すぐ同期',
        pendingButton: '同期中…',
        statusIdle: '待機中',
        statusBootstrapping: 'bootstrap 進行中'
      },
      toast: {
        skipped: '別の同期が実行中のため、スキップしました',
        error: insert('同期に失敗しました: {{message}}'),
        aborted: insert('一部の変更を反映して停止しました: {{reason}}'),
        success: insert('{{upserts}} 件を反映し、{{deletes}} 件を削除しました'),
        successBootstrapping: '台帳の取得（bootstrap）はまだ完了していません。もう一度実行すると、続きから取得します。',
        requestFailed: '同期リクエストに失敗しました'
      }
    },
    en: {
      title: 'Library sync',
      count: 'Manually sync the Nagisa recording library to D1',
      row: {
        label: 'Full library sync',
        description:
          'Manually sync the Nagisa recording library to D1. Starts from the beginning unless bootstrap is already in progress.',
        idleButton: 'Sync now',
        pendingButton: 'Syncing…',
        statusIdle: 'Idle',
        statusBootstrapping: 'Bootstrap in progress'
      },
      toast: {
        skipped: 'Skipped because another sync is running',
        error: insert('Sync failed: {{message}}'),
        aborted: insert('Sync stopped after applying partial changes: {{reason}}'),
        success: insert('Applied: {{upserts}} · Deleted: {{deletes}}'),
        successBootstrapping: 'Library bootstrap is still in progress. Run sync again to continue.',
        requestFailed: 'Failed to request sync'
      }
    }
  })
} satisfies Dictionary

export default librarySyncSectionContent
