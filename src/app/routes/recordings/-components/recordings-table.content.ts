import { type Dictionary, insert, t } from 'intlayer'

const recordingsTableContent = {
  key: 'recordings-recordings-table',
  content: t({
    ja: {
      recordedBadge: {
        recorded: '録画済み',
        pending: '未録画'
      },
      nextEpisodePrefix: '次回 ',
      remainingDays: insert('あと {{days}} 日'),
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
        airing: '放送',
        recorded: '録画',
        updatedAt: '最終更新',
        expiresAt: '配信終了'
      }
    },
    en: {
      recordedBadge: {
        recorded: 'Recorded',
        pending: 'Not recorded'
      },
      nextEpisodePrefix: 'Next ',
      remainingDays: insert('Time remaining: {{days}} d'),
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
        airing: 'Broadcast',
        recorded: 'Recording status',
        updatedAt: 'Last updated',
        expiresAt: 'Available until'
      }
    }
  })
} satisfies Dictionary

export default recordingsTableContent
