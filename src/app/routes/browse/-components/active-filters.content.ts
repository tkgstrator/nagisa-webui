import { type Dictionary, insert, t } from 'intlayer'

const activeFiltersContent = {
  key: 'browse-active-filters',
  content: t({
    ja: {
      openFilters: '絞り込み',
      applied: '適用中',
      clearChipLabel: insert('{{label}} {{value}} を解除'),
      clearAll: 'すべて解除'
    },
    en: {
      openFilters: 'Filters',
      applied: 'Applied',
      clearChipLabel: insert('Remove {{label}}: {{value}}'),
      clearAll: 'Clear all'
    }
  })
} satisfies Dictionary

export default activeFiltersContent
