import { type Dictionary, t } from 'intlayer'

const settingsPageContent = {
  key: 'settings',
  content: t({
    ja: {
      savedNotice: {
        lead: '設定 · ',
        scope: 'このブラウザにだけ',
        tail: '保存される'
      },
      title: '表示と録画のふるまい',
      description: '変更はその場で反映される。保存ボタンはない。',
      savedLabel: '保存済み '
    }
  })
} satisfies Dictionary

export default settingsPageContent
