import { type Dictionary, insert, t } from 'intlayer'

const browsePaginationContent = {
  key: 'browse-browse-pagination',
  content: t({
    ja: {
      ariaLabel: 'ページネーション',
      rangeOf: insert('/ {{total}} 件'),
      pageSizeLabel: '表示件数'
    },
    en: {
      ariaLabel: 'Pagination',
      rangeOf: insert('/ {{total}} items'),
      pageSizeLabel: 'Items per page'
    }
  })
} satisfies Dictionary

export default browsePaginationContent
