import { type Dictionary, t } from 'intlayer'

const appFooterContent = {
  key: 'app-footer',
  content: t({
    ja: {
      changelog: '変更履歴',
      admin: '管理'
    },
    en: {
      changelog: 'Changelog',
      admin: 'Admin'
    }
  })
} satisfies Dictionary

export default appFooterContent
