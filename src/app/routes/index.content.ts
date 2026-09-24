import { type Dictionary, insert, t } from 'intlayer'

const homeContent = {
  key: 'home',
  content: t({
    ja: {
      weekdays: ['日', '月', '火', '水', '木', '金', '土'],
      summary: {
        seasonSuffix: insert('{{season}}クール'),
        title: '今日の録画状況',
        dateFormat: 'M月D日',
        tiles: {
          newEpisode: {
            label: '新着エピソード',
            unit: '作品',
            note: insert('うち {{count}} 作品が未録画')
          },
          scheduled: {
            label: '録画予約中',
            unit: '作品',
            note: insert('直近 {{count}} 作品が更新')
          },
          comingSoon: {
            label: 'もうすぐ配信',
            unit: '作品'
          },
          expiring: {
            label: '配信終了予定',
            unit: '作品',
            note: insert('うち {{count}} 作品が未録画')
          }
        }
      },
      newEpisodes: {
        title: '新着エピソード',
        subtitle: '最近エピソードが追加された作品',
        flagLabel: '新着エピソード'
      },
      scheduledUpdates: {
        subtitle: insert('更新日時が新しい順・最大{{limit}}件')
      },
      tabs: {
        sectionTitle: 'カタログを探す',
        season: '今期アニメ',
        added: '新着追加',
        comingSoon: 'もうすぐ配信',
        expiring: '配信終了予定',
        provider: '配信元から探す',
        viewAll: 'すべて見る',
        empty: {
          season: {
            title: '今期の作品はまだありません',
            description: 'カタログの取得が終わるとここに表示されます。'
          },
          added: {
            title: '新しく追加された作品はありません',
            description: '新規追加があるとここに並びます。'
          },
          comingSoon: {
            title: '配信予定の作品はありません',
            description: '配信開始が近づくとここに表示されます。'
          },
          expiring: {
            title: '配信終了予定の作品はありません',
            description: '終了予定が決まるとここに表示されます。'
          },
          provider: {
            title: '配信元別のデータはありません',
            description: '今期の作品が揃うと配信元ごとに並びます。'
          }
        },
        tags: {
          added: '新着追加',
          comingSoon: '配信予定',
          expiring: '配信終了予定'
        }
      },
      links: {
        sectionTitle: '探す',
        browse: {
          title: 'アニメ一覧',
          prefix: '今クール',
          suffix: '作品'
        },
        recordings: {
          title: '録画一覧',
          prefix: '予約',
          suffix: '作品'
        },
        expiring: {
          title: '配信終了予定',
          countLabel: '作品が終了予定 · 未録画',
          unit: '作品'
        }
      }
    }
  })
} satisfies Dictionary

export default homeContent
