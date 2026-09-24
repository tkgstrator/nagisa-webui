import { type Dictionary, t } from 'intlayer'

const recordingsHeaderContent = {
  key: 'recordings-recordings-header',
  content: t({
    ja: {
      title: '録画一覧',
      scheduledSuffix: ' 作品を予約中',
      searchLabel: 'タイトル検索',
      searchPlaceholder: 'タイトルで絞り込み'
    }
  })
} satisfies Dictionary

export default recordingsHeaderContent
