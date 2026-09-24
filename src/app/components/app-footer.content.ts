import { type Dictionary, t } from 'intlayer'

const appFooterContent = {
  key: 'app-footer',
  content: t({
    ja: {
      changelog: '変更履歴',
      admin: '管理'
    }
  })
} satisfies Dictionary

export default appFooterContent
