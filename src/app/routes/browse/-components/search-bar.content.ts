import { type Dictionary, t } from 'intlayer'

const searchBarContent = {
  key: 'browse-search-bar',
  content: t({
    ja: {
      placeholder: 'タイトルで検索'
    },
    en: {
      placeholder: 'Search by title'
    }
  })
} satisfies Dictionary

export default searchBarContent
