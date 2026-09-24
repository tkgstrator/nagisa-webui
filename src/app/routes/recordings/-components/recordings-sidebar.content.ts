import { type Dictionary, t } from 'intlayer'

const recordingsSidebarContent = {
  key: 'recordings-recordings-sidebar',
  content: t({
    ja: {
      heading: '録画サマリ',
      scheduled: '録画予約中',
      recorded: '録画済み',
      pending: '未録画'
    }
  })
} satisfies Dictionary

export default recordingsSidebarContent
