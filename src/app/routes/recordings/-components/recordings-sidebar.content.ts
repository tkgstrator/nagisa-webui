import { type Dictionary, t } from 'intlayer'

const recordingsSidebarContent = {
  key: 'recordings-recordings-sidebar',
  content: t({
    ja: {
      heading: '録画状況の概要',
      scheduled: '録画予約中',
      recorded: '録画済み',
      pending: '未録画'
    },
    en: {
      heading: 'Recording summary',
      scheduled: 'Scheduled',
      recorded: 'Recorded',
      pending: 'Not recorded'
    }
  })
} satisfies Dictionary

export default recordingsSidebarContent
