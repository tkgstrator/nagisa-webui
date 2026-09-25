import { type Dictionary, insert, t } from 'intlayer'

const recordingsTableContent = {
  key: 'recordings-recordings-table',
  content: t({
    ja: {
      selectRow: insert('{{title}} を選択'),
      unscheduleRow: insert('{{title}} の予約を解除'),
      unschedule: '予約解除',
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
        others: {
          label: 'その他',
          hint: '完結・未放送・休止を含みます'
        }
      },
      groupCount: insert('{{count}} 作品'),
      columns: {
        select: '選択',
        title: '作品',
        provider: '配信元',
        airing: '放送',
        recorded: '録画',
        updatedAt: '最終更新',
        expiresAt: '配信終了',
        actions: '操作'
      }
    },
    en: {
      selectRow: insert('Select {{title}}'),
      unscheduleRow: insert('Cancel the recording schedule for {{title}}'),
      unschedule: 'Cancel schedule',
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
        others: {
          label: 'Other',
          hint: 'Includes finished, unaired, and on-hiatus anime'
        }
      },
      groupCount: insert('{{count}} titles'),
      columns: {
        select: 'Select',
        title: 'titles',
        provider: 'Provider',
        airing: 'Broadcast',
        recorded: 'Recording status',
        updatedAt: 'Last updated',
        expiresAt: 'Available until',
        actions: 'Actions'
      }
    }
  })
} satisfies Dictionary

export default recordingsTableContent
