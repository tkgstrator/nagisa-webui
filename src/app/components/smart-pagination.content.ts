import { type Dictionary, t } from 'intlayer'

const smartPaginationContent = {
  key: 'smart-pagination',
  content: t({
    ja: {
      previous: '前へ',
      next: '次へ'
    },
    en: {
      previous: 'Previous',
      next: 'Next'
    }
  })
} satisfies Dictionary

export default smartPaginationContent
