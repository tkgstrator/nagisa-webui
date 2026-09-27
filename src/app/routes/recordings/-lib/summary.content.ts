import { type Dictionary, insert, t } from 'intlayer'

const summaryContent = {
  key: 'recordings-summary',
  content: t({
    ja: {
      searchTerm: insert('検索: {{search}}'),
      expiringOnly: '配信終了予定のみ'
    },
    en: {
      searchTerm: insert('Search: {{search}}'),
      expiringOnly: 'Leaving soon only'
    }
  })
} satisfies Dictionary

export default summaryContent
