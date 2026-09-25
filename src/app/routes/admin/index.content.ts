import { type Dictionary, t } from 'intlayer'

const adminContent = {
  key: 'admin',
  content: t({
    ja: {
      title: '管理',
      description: '運用・デバッグ用のツール',
      items: {
        unidentified: {
          title: '未識別タイトル一覧',
          description: 'AniList で照合できなかった作品を確認・修正します。'
        },
        nagisa: {
          title: 'Nagisa ジョブ投入',
          description: '配信元と content_id を指定して、Nagisa に録画ジョブを直接送信します。'
        },
        abema: {
          title: 'ABEMA 鍵アーカイブ',
          description: '復号鍵が未取得の ABEMA 作品を確認し、取得ジョブをキューに追加します。'
        },
        logs: {
          title: '同期ログ',
          description: 'cron とキューバッチの実行履歴、および cron の稼働状況を確認します。'
        },
        status: {
          title: 'サーバーステータス',
          description: 'Nagisa の稼働状況・キュー・録画台帳と、WebUI 側の同期状態を確認します。'
        }
      }
    },
    en: {
      title: 'Admin',
      description: 'Tools for operations and debugging',
      items: {
        unidentified: {
          title: 'Unmatched titles',
          description: 'Review and update titles that could not be matched on AniList.'
        },
        nagisa: {
          title: 'Submit Nagisa jobs',
          description: 'Submit recording jobs directly to Nagisa using a provider and content_id.'
        },
        abema: {
          title: 'ABEMA key archive',
          description: 'Review ABEMA titles with missing decryption keys and queue retrieval jobs.'
        },
        logs: {
          title: 'Sync logs',
          description: 'View cron and queue batch run history and check cron activity.'
        },
        status: {
          title: 'Server status',
          description: 'Check Nagisa health, queues, recording library, and WebUI sync status.'
        }
      }
    }
  })
} satisfies Dictionary

export default adminContent
