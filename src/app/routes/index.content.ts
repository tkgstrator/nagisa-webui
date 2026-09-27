import { type Dictionary, insert, t } from 'intlayer'

const homeContent = {
  key: 'home',
  content: t({
    ja: {
      weekdays: ['日', '月', '火', '水', '木', '金', '土'],
      summary: {
        seasonSuffix: insert('{{season}}'),
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
        subtitle: insert('更新が新しい順・最大 {{limit}} 件')
      },
      tabs: {
        sectionTitle: 'カタログを探す',
        season: '今期アニメ',
        added: '新規追加',
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
            description: '新しく追加された作品がここに表示されます。'
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
            description: '今期の作品が取得されると、配信元ごとに表示されます。'
          }
        },
        tags: {
          added: '新規追加',
          comingSoon: '配信予定',
          expiring: '配信終了予定'
        }
      },
      links: {
        sectionTitle: '探す',
        browse: {
          title: 'アニメ一覧',
          prefix: '今期',
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
    },
    en: {
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      summary: {
        seasonSuffix: insert('{{season}}'),
        title: "Today's recording status",
        dateFormat: 'M/D',
        tiles: {
          newEpisode: {
            label: 'New episodes',
            unit: 'titles',
            note: insert('Not yet recorded: {{count}} titles')
          },
          scheduled: {
            label: 'Scheduled',
            unit: 'titles',
            note: insert('Recently updated: {{count}} titles')
          },
          comingSoon: {
            label: 'Coming soon',
            unit: 'titles'
          },
          expiring: {
            label: 'Leaving soon',
            unit: 'titles',
            note: insert('Not yet recorded: {{count}} titles')
          }
        }
      },
      newEpisodes: {
        title: 'New episodes',
        subtitle: 'Anime with recently added episodes',
        flagLabel: 'New episodes'
      },
      scheduledUpdates: {
        subtitle: insert('Most recently updated first · Up to {{limit}} titles')
      },
      tabs: {
        sectionTitle: 'Explore the catalog',
        season: 'This season',
        added: 'Recently added',
        comingSoon: 'Coming soon',
        expiring: 'Leaving soon',
        provider: 'Browse by provider',
        viewAll: 'View all',
        empty: {
          season: {
            title: 'No anime for this season yet',
            description: 'Anime will appear here once the catalog has loaded.'
          },
          added: {
            title: 'No recently added anime',
            description: 'Newly added anime will appear here.'
          },
          comingSoon: {
            title: 'No upcoming anime',
            description: 'Anime will appear here as its release date approaches.'
          },
          expiring: {
            title: 'No anime leaving soon',
            description: 'Anime will appear here when its availability end date is announced.'
          },
          provider: {
            title: 'No data by provider',
            description: "This season's anime will appear here by provider once available."
          }
        },
        tags: {
          added: 'Recently added',
          comingSoon: 'Upcoming',
          expiring: 'Leaving soon'
        }
      },
      links: {
        sectionTitle: 'Explore',
        browse: {
          title: 'Browse anime',
          prefix: 'This season:',
          suffix: 'titles'
        },
        recordings: {
          title: 'Recordings',
          prefix: 'Scheduled:',
          suffix: 'titles'
        },
        expiring: {
          title: 'Leaving soon',
          countLabel: 'titles leaving soon · Not recorded:',
          unit: 'titles'
        }
      }
    }
  })
} satisfies Dictionary

export default homeContent
