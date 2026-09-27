import { type Dictionary, insert, t } from 'intlayer'

const animeCarouselContent = {
  key: 'anime-carousel',
  content: t({
    ja: {
      viewAll: 'すべて見る',
      dateBadge: {
        until: insert('{{date}}まで'),
        today: insert('今日 {{time}}'),
        tomorrow: insert('明日 {{time}}')
      },
      season: insert('{{year}}年{{quarter}}'),
      recordingState: {
        recorded: '録画済み',
        scheduled: '予約中'
      }
    },
    en: {
      viewAll: 'View all',
      dateBadge: {
        until: insert('Until {{date}}'),
        today: insert('Today at {{time}}'),
        tomorrow: insert('Tomorrow at {{time}}')
      },
      season: insert('{{quarter}} {{year}}'),
      recordingState: {
        recorded: 'Recorded',
        scheduled: 'Scheduled'
      }
    }
  })
} satisfies Dictionary

export default animeCarouselContent
