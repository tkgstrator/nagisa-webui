import { type Dictionary, insert, t } from 'intlayer'

const summaryContent = {
  key: 'recordings-summary',
  content: t({
    ja: {
      searchTerm: insert('検索: {{search}}'),
      expiringOnly: '配信終了予定のみ',
      recordedTerms: { pending: '未録画', recorded: '録画済み' }
    },
    en: {
      searchTerm: insert('Search: {{search}}'),
      expiringOnly: 'Leaving soon only',
      recordedTerms: { pending: 'Not recorded', recorded: 'Recorded' }
    }
  })
} satisfies Dictionary

export default summaryContent
