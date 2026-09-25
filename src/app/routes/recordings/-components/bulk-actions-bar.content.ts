import { type Dictionary, t } from 'intlayer'

const bulkActionsBarContent = {
  key: 'recordings-bulk-actions-bar',
  content: t({
    ja: {
      selectAllVisible: '表示中の作品をすべて選択',
      selectedSuffix: ' 件選択中',
      bulkUnschedule: '選択した予約を解除'
    },
    en: {
      selectAllVisible: 'Select all visible items',
      selectedSuffix: ' selected',
      bulkUnschedule: 'Cancel selected schedules'
    }
  })
} satisfies Dictionary

export default bulkActionsBarContent
