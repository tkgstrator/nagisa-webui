import { type Dictionary, t } from 'intlayer'

const confirmUnscheduleDialogContent = {
  key: 'recordings-confirm-unschedule-dialog',
  content: t({
    ja: {
      title: '選択した予約を解除しますか',
      descriptionSuffix: '件の予約を解除します。録画済みのファイルは削除されません。',
      cancel: 'やめる',
      confirm: '解除する'
    }
  })
} satisfies Dictionary

export default confirmUnscheduleDialogContent
