import { type Dictionary, t } from 'intlayer'

const settingsPageContent = {
  key: 'settings',
  content: t({
    ja: {
      savedNotice: {
        lead: '設定 · ',
        scope: 'このブラウザにのみ',
        tail: '保存されます'
      },
      title: '表示と録画の設定',
      description: '変更はすぐに反映されます。保存ボタンを押す必要はありません。',
      savedLabel: '保存済み '
    },
    en: {
      savedNotice: {
        lead: 'Settings · Saved ',
        scope: 'only in this browser',
        tail: ''
      },
      title: 'Display and recording settings',
      description: 'Changes take effect immediately. There is no save button.',
      savedLabel: 'Saved '
    }
  })
} satisfies Dictionary

export default settingsPageContent
