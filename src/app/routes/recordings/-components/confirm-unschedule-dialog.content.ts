import { type Dictionary, t } from 'intlayer'

const confirmUnscheduleDialogContent = {
  key: 'recordings-confirm-unschedule-dialog',
  content: t({
    ja: {
      title: '選択した予約を解除しますか？',
      descriptionSuffix: '件の予約を解除します。録画済みのファイルは削除されません。',
      cancel: 'キャンセル',
      confirm: '予約を解除'
    },
    en: {
      title: 'Cancel the selected schedules?',
      descriptionSuffix: 'selected for cancellation. Recorded files will not be deleted.',
      cancel: 'Keep schedules',
      confirm: 'Cancel schedules'
    }
  })
} satisfies Dictionary

export default confirmUnscheduleDialogContent
