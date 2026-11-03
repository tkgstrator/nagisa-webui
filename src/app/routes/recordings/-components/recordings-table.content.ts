import { type Dictionary, insert, t } from 'intlayer'

const recordingsTableContent = {
  key: 'recordings-recordings-table',
  content: t({
    ja: {
      statuses: {
        completed: '完了',
        incomplete: '未録画あり',
        recording: '放送中',
        upcoming: '放送前',
        hiatus: '休止',
        cancelled: '中止'
      },
      nextEpisodePrefix: '次回 ',
      groups: {
        airing: {
          label: '放送中',
          hint: '新しいエピソードが順次追加されます'
        },
        finished: {
          label: '完結',
          hint: '放送が終わった作品です。予約は詳細ページから取り消せます'
        },
        others: {
          label: 'その他',
          hint: '未放送・休止などの作品です'
        }
      },
      groupCount: insert('{{count}} 作品'),
      columns: {
        title: '作品',
        provider: '配信元',
        status: '状態',
        updatedAt: '最終更新'
      }
    },
    en: {
      statuses: {
        completed: 'Completed',
        incomplete: 'Incomplete',
        recording: 'Recording',
        upcoming: 'Upcoming',
        hiatus: 'On hiatus',
        cancelled: 'Cancelled'
      },
      nextEpisodePrefix: 'Next ',
      groups: {
        airing: {
          label: 'Airing',
          hint: 'New episodes are added as they air'
        },
        finished: {
          label: 'Finished',
          hint: 'These have finished airing. Cancel the schedule from the detail page'
        },
        others: {
          label: 'Other',
          hint: 'Not yet aired, on hiatus, and so on'
        }
      },
      groupCount: insert('{{count}} titles'),
      columns: {
        title: 'titles',
        provider: 'Provider',
        status: 'Status',
        updatedAt: 'Last updated'
      }
    }
  })
} satisfies Dictionary

export default recordingsTableContent
