import { type Dictionary, t } from 'intlayer'

const adminLogsRecordingsTableContent = {
  key: 'admin-logs-recordings-table',
  content: t({
    ja: {
      headers: {
        dateTime: '日時',
        anime: '作品',
        provider: '配信元',
        kind: '種別',
        route: '経路',
        episode: '話数',
        http: 'HTTP',
        result: '結果'
      },
      empty: 'この期間の録画イベントはありません'
    }
  })
} satisfies Dictionary

export default adminLogsRecordingsTableContent
