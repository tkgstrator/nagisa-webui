import { type Dictionary, t } from 'intlayer'

const dataSectionContent = {
  key: 'settings-data-section',
  content: t({
    ja: {
      title: 'データ',
      count: 'このブラウザに残っているもの',
      cache: {
        label: '画像キャッシュ',
        description: 'ポスターの WebP を端末に保持している分。消しても作品データは残る。',
        deleteButton: '削除',
        unavailableError: 'このブラウザではキャッシュを操作できない',
        deletedToast: '画像キャッシュを削除した'
      },
      transfer: {
        label: '設定の書き出しと読み込み',
        description: 'この画面の内容を JSON で保存し、別の端末に持ち込める。',
        exportButton: '書き出す',
        importButton: '読み込む',
        exportedToast: '設定を書き出した',
        importedToast: '設定を読み込んだ',
        importFailedToast: '設定ファイルを読み取れなかった'
      },
      reset: {
        label: 'すべての設定を初期化する',
        description: 'この画面の内容だけが既定に戻る。録画予約と作品データには触れない。',
        triggerButton: '初期化',
        dialogTitle: '設定を初期化する',
        cancelButton: 'やめる',
        confirmButton: '初期化する',
        resetToast: '設定を初期化した'
      }
    }
  })
} satisfies Dictionary

export default dataSectionContent
