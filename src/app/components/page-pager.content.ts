import { type Dictionary, insert, t } from 'intlayer'

const pagePagerContent = {
  key: 'page-pager',
  content: t({
    ja: {
      previous: '前のページ',
      next: '次のページ',
      pages: insert(' / {{totalPages}} ページ · {{total}}件')
    },
    en: {
      previous: 'Previous page',
      next: 'Next page',
      pages: insert(' / {{totalPages}} pages · {{total}} items')
    }
  })
} satisfies Dictionary

export default pagePagerContent
