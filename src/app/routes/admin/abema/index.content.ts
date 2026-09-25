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
      description: '復号鍵が未取得の ABEMA 作品を確認し、取得ジョブをキューに追加します。',
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
          note: '1 作品につき 1 件のジョブを追加します'
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
      footerNote: '鍵が未取得の ABEMA 作品をすべてキューに追加します。ジョブは順次処理されます。'
    },
    en: {
      toast: {
        nothingToEnqueue: 'No titles with missing keys',
        enqueued: insert('Queued {{enqueued}} titles'),
        enqueueFailed: 'Failed to add jobs to the queue'
      },
      title: 'ABEMA key archive',
      description: 'Find ABEMA titles with missing decryption keys and queue retrieval jobs.',
      loading: 'Loading statistics…',
      loadError: 'Failed to load statistics',
      sectionLabel: 'Archive status',
      stats: {
        totalAnime: {
          label: 'ABEMA titles',
          unit: 'titles',
          note: insert('Keys archived for {{count}} titles')
        },
        missingKey: {
          label: 'Titles with missing keys',
          unit: 'titles',
          note: 'One job is queued per title'
        },
        totalEpisodes: {
          label: 'Total episodes',
          unit: 'episodes',
          note: insert('Archived: {{archived}} episodes · Pending: {{pending}} episodes')
        }
      },
      enqueueButton: {
        pending: 'Queuing…',
        idle: 'Queue key retrieval jobs'
      },
      footerNote: 'Queue all ABEMA titles with missing keys. Jobs are processed in order.'
    }
  })
} satisfies Dictionary

export default adminAbemaContent
