import { type Dictionary, t } from 'intlayer'

const adminLogsCatalogTableContent = {
  key: 'admin-logs-catalog-table',
  content: t({
    ja: {
      headers: {
        dateTime: '日時',
        anime: '作品',
        provider: '配信元',
        kind: '種別',
        detail: '内容',
        episode: '話数'
      },
      empty: 'この期間のカタログ変化はありません'
    }
  })
} satisfies Dictionary

export default adminLogsCatalogTableContent
