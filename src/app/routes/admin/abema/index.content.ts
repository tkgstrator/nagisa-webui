import { type Dictionary, insert, t } from 'intlayer'

const adminAbemaContent = {
  key: 'admin-abema',
  content: t({
    ja: {
      toast: {
        nothingToEnqueue: '鍵が未取得の作品はありません',
        enqueued: insert('{{enqueued}} 作品をキューに投入しました'),
        enqueueFailed: 'キューへの投入に失敗しました'
      },
      title: 'ABEMA 鍵アーカイブ',
      description: '復号鍵が未取得の ABEMA 作品を洗い出し、取得ジョブをキューに投入する',
      loading: '集計を読み込んでいます…',
      loadError: '集計を取得できませんでした',
      sectionLabel: 'アーカイブ状況',
      stats: {
        totalAnime: {
          label: 'ABEMA 作品',
          unit: '作品',
          note: insert('うち {{count}} 作品が取得済み')
        },
        missingKey: {
          label: '鍵が未取得の作品',
          unit: '作品',
          note: '投入すると 1 作品 1 ジョブで処理する'
        },
        totalEpisodes: {
          label: 'エピソード総数',
          unit: '話',
          note: insert('取得済み {{archived}} 話 · 未取得 {{pending}} 話')
        }
      },
      enqueueButton: {
        pending: '投入中…',
        idle: '鍵取得ジョブを投入'
      },
      footerNote: '鍵が未取得の ABEMA 作品をすべてキューに送る。処理はキュー側で順次進む。'
    }
  })
} satisfies Dictionary

export default adminAbemaContent
