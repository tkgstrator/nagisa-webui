import { type Dictionary, t } from 'intlayer'

const bulkActionsBarContent = {
  key: 'recordings-bulk-actions-bar',
  content: t({
    ja: {
      selectAllVisible: '表示中をすべて選択',
      selectedSuffix: ' 件選択中',
      bulkUnschedule: '選択分を解除'
    }
  })
} satisfies Dictionary

export default bulkActionsBarContent
