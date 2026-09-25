import { type Dictionary, insert, t } from 'intlayer'

const useUnscheduleContent = {
  key: 'recordings-use-unschedule',
  content: t({
    ja: {
      unscheduled: '予約を解除しました',
      unscheduleFailed: '予約解除に失敗しました',
      bulkUnscheduled: insert('{{count}} 件の予約を解除しました'),
      bulkPartial: insert('{{succeeded}} 件解除、{{failed}} 件失敗'),
      bulkFailed: '一括解除に失敗しました'
    },
    en: {
      unscheduled: 'Recording schedule cancelled',
      unscheduleFailed: 'Failed to cancel the recording schedule',
      bulkUnscheduled: insert('Recording schedules cancelled: {{count}}'),
      bulkPartial: insert('Cancelled: {{succeeded}} · Failed: {{failed}}'),
      bulkFailed: 'Failed to cancel selected schedules'
    }
  })
} satisfies Dictionary

export default useUnscheduleContent
