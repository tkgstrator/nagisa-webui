import { type Dictionary, t } from 'intlayer'

const viewToggleContent = {
  key: 'recordings-view-toggle',
  content: t({
    ja: {
      ariaLabel: '表示切り替え',
      views: {
        list: '一覧',
        schedule: '週間スケジュール'
      }
    },
    en: {
      ariaLabel: 'Switch view',
      views: {
        list: 'List',
        schedule: 'Weekly schedule'
      }
    }
  })
} satisfies Dictionary

export default viewToggleContent
