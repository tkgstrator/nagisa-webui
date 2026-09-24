import { type Dictionary, t } from 'intlayer'

const adminLogsRecordingsTableContent = {
  key: 'admin-logs-recordings-table',
  content: t({
    ja: {
      headers: {
        dateTime: '日時',
        anime: '作品',
        kind: '種別',
        route: '経路',
        episode: '話数',
        result: '結果'
      }
    }
  })
} satisfies Dictionary

export default adminLogsRecordingsTableContent
