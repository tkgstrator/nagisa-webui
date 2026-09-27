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
      sortAriaLabel: '並べ替え',
      noResults: '条件に合うアニメが見つかりません',
      resetFilters: '絞り込みをリセット',
      filterSheetTitle: '絞り込み'
    },
    en: {
      title: 'Browse anime',
      filtered: {
        of: ' titles total ·',
        matching: ' matching',
        managing: ' anime titles in the catalog'
      },
      sortAriaLabel: 'Sort',
      noResults: 'No anime matches your filters',
      resetFilters: 'Reset filters',
      filterSheetTitle: 'Filters'
    }
  })
} satisfies Dictionary

export default browseContent
