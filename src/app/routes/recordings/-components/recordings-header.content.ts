import { type Dictionary, insert, t } from 'intlayer'

const recordingsHeaderContent = {
  key: 'recordings-recordings-header',
  content: t({
    ja: {
      title: '録画一覧',
      scheduledSuffix: ' 作品を予約中',
      finishedHidden: insert(' · 完結した {{count}} 作品は非表示'),
      searchLabel: 'タイトル検索',
      searchPlaceholder: 'タイトルで絞り込み'
    },
    en: {
      title: 'Recordings',
      scheduledSuffix: ' titles scheduled',
      finishedHidden: insert(' · {{count}} finished titles hidden'),
      searchLabel: 'Search by title',
      searchPlaceholder: 'Filter by title'
    }
  })
} satisfies Dictionary

export default recordingsHeaderContent
