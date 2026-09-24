import { type Dictionary, insert, t } from 'intlayer'

const summaryContent = {
  key: 'recordings-summary',
  content: t({
    ja: {
      searchTerm: insert('検索: {{search}}'),
      expiringOnly: '配信終了予定のみ'
    }
  })
} satisfies Dictionary

export default summaryContent
