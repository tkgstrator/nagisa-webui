import { type Dictionary, t } from 'intlayer'

const browseContent = {
  key: 'browse',
  content: t({
    ja: {
      title: 'アニメ一覧',
      filtered: {
        of: '件中',
        matching: '件に絞り込み中',
        managing: '件のアニメを管理中'
      },
      sortAriaLabel: '並び替え',
      noResults: '条件に合うアニメが見つかりません',
      resetFilters: 'フィルタをリセット',
      filterSheetTitle: '絞り込み'
    }
  })
} satisfies Dictionary

export default browseContent
