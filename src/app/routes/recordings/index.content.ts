import { type Dictionary, insert, t } from 'intlayer'

const recordingsContent = {
  key: 'recordings',
  content: t({
    ja: {
      legend: {
        ariaLabel: '行頭の色の凡例',
        recorded: '録画済み',
        expiring: '配信終了予定',
        pending: '未録画'
      },
      rangeText: insert('{{start}}–{{end}} / {{total}} 件')
    },
    en: {
      legend: {
        ariaLabel: 'Row color legend',
        recorded: 'Recorded',
        expiring: 'Leaving soon',
        pending: 'Not recorded'
      },
      rangeText: insert('{{start}}–{{end}} / {{total}} items')
    }
  })
} satisfies Dictionary

export default recordingsContent
