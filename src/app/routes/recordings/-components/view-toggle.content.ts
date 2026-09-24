import { type Dictionary, t } from 'intlayer'

const viewToggleContent = {
  key: 'recordings-view-toggle',
  content: t({
    ja: {
      ariaLabel: '表示切替',
      views: {
        list: '一覧',
        schedule: '週間スケジュール'
      }
    }
  })
} satisfies Dictionary

export default viewToggleContent
