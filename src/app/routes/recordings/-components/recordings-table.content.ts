import { type Dictionary, insert, t } from 'intlayer'

const recordingsTableContent = {
  key: 'recordings-recordings-table',
  content: t({
    ja: {
      selectRow: insert('{{title}} を選択'),
      unscheduleRow: insert('{{title}} の予約を解除'),
      unschedule: '解除',
      recordedBadge: {
        recorded: '録画済み',
        pending: '未録画'
      },
      nextEpisodePrefix: '次回 ',
      remainingDays: insert('あと {{days}} 日'),
      groups: {
        airing: { label: '放送中', hint: '新しい話が順次追加されます' },
        others: { label: 'その他', hint: '完結・未放送・休止を含みます' }
      },
      groupCount: insert('{{count}} 作品'),
      columns: {
        select: '選択',
        title: '作品',
        provider: 'プロバイダ',
        airing: '放送',
        recorded: '録画',
        updatedAt: '最終更新',
        expiresAt: '配信終了',
        actions: '操作'
      }
    }
  })
} satisfies Dictionary

export default recordingsTableContent
