import { type Dictionary, t } from 'intlayer'

const recordingsEmptyContent = {
  key: 'recordings-recordings-empty',
  content: t({
    ja: {
      filtered: {
        title: '条件に合う録画予約はありません',
        description:
          '絞り込み条件を減らすか、リセットしてください。配信元や録画状態にかかわらず、予約は保持されています。'
      },
      empty: {
        title: 'まだ録画予約がありません',
        description:
          'アニメ一覧から作品を開き、録画予約をオンにすると、ここに表示されます。予約した作品は、新しいエピソードが配信されるたびに自動で録画されます。'
      },
      reset: '絞り込みをリセット',
      browse: 'アニメ一覧から探す'
    },
    en: {
      filtered: {
        title: 'No recording schedules match your filters',
        description:
          'Try fewer filters or reset them. Your schedules are kept regardless of provider or recording status.'
      },
      empty: {
        title: 'No recording schedules yet',
        description:
          'Open an anime from the catalog and enable scheduled recording to add it here. New episodes of scheduled anime are recorded automatically as they become available.'
      },
      reset: 'Reset filters',
      browse: 'Browse anime'
    }
  })
} satisfies Dictionary

export default recordingsEmptyContent
