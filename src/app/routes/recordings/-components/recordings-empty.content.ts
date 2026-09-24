import { type Dictionary, t } from 'intlayer'

const recordingsEmptyContent = {
  key: 'recordings-recordings-empty',
  content: t({
    ja: {
      filtered: {
        title: '条件に合う録画予約はありません',
        description:
          '絞り込みを緩めるか、条件をリセットしてください。予約中の作品はプロバイダや録画状態をまたいで保持されています。'
      },
      empty: {
        title: 'まだ録画予約がありません',
        description:
          'アニメ一覧から作品を開き、録画予約をオンにすると、ここに並びます。予約した作品は新しい話が配信されるたびに自動で録画されます。'
      },
      reset: '条件をリセット',
      browse: 'アニメ一覧から探す'
    }
  })
} satisfies Dictionary

export default recordingsEmptyContent
