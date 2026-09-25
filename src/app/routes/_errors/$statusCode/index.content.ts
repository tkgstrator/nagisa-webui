import { type Dictionary, insert, t } from 'intlayer'

const errorsStatusCodeContent = {
  key: 'errors-status-code',
  content: t({
    ja: {
      testError: insert('テスト用エラー ({{code}})')
    },
    en: {
      testError: insert('Test error ({{code}})')
    }
  })
} satisfies Dictionary

export default errorsStatusCodeContent
