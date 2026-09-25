import { type Dictionary, t } from 'intlayer'

const dataSectionContent = {
  key: 'settings-data-section',
  content: t({
    ja: {
      title: 'データ',
      count: 'このブラウザに保存されているデータ',
      cache: {
        label: '画像キャッシュ',
        description: '端末に保存された WebP 形式のポスター画像です。削除しても作品データは残ります。',
        deleteButton: '削除',
        unavailableError: 'このブラウザではキャッシュを操作できません',
        deletedToast: '画像キャッシュを削除しました'
      },
      transfer: {
        label: '設定の書き出しと読み込み',
        description: 'この画面の設定を JSON ファイルに保存し、別の端末に移行できます。',
        exportButton: '書き出す',
        importButton: '読み込む',
        exportedToast: '設定を書き出しました',
        importedToast: '設定を読み込みました',
        importFailedToast: '設定ファイルを読み取れませんでした'
      },
      reset: {
        label: 'すべての設定を初期化する',
        description: 'この画面の設定のみを既定値に戻します。録画予約と作品データは変更されません。',
        triggerButton: '初期化',
        dialogTitle: '設定を初期化する',
        cancelButton: 'キャンセル',
        confirmButton: '初期化する',
        resetToast: '設定を初期化しました'
      }
    },
    en: {
      title: 'Data',
      count: 'Data stored in this browser',
      cache: {
        label: 'Image cache',
        description: 'WebP poster images cached on this device. Clearing them does not delete anime data.',
        deleteButton: 'Delete',
        unavailableError: 'Cache management is not available in this browser',
        deletedToast: 'Image cache cleared'
      },
      transfer: {
        label: 'Export and import settings',
        description: 'Save these settings as JSON to transfer them to another device.',
        exportButton: 'Export',
        importButton: 'Import',
        exportedToast: 'Settings exported',
        importedToast: 'Settings imported',
        importFailedToast: 'Could not read the settings file'
      },
      reset: {
        label: 'Reset all settings',
        description:
          'Only settings on this page are reset to their defaults. Recording schedules and anime data are not affected.',
        triggerButton: 'Reset',
        dialogTitle: 'Reset settings',
        cancelButton: 'Cancel',
        confirmButton: 'Reset',
        resetToast: 'Settings reset'
      }
    }
  })
} satisfies Dictionary

export default dataSectionContent
