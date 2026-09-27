import { type Dictionary, t } from 'intlayer'

const catalogTableContent = {
  key: 'admin-logs-catalog-table',
  content: t({
    ja: {
      empty: 'この期間のカタログ変化はありません',
      headers: { dateTime: '日時', anime: '作品', provider: '配信元', kind: '種別', detail: '内容', episodes: '話数' }
    },
    en: {
      empty: 'No catalog changes in this period',
      headers: {
        dateTime: 'Date and time',
        anime: 'Title',
        provider: 'Provider',
        kind: 'Type',
        detail: 'Details',
        episodes: 'Episodes'
      }
    }
  })
} satisfies Dictionary

export default catalogTableContent
