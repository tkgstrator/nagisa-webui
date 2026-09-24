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
          description: 'AniList で識別できなかったタイトルを確認・調整する'
        },
        nagisa: {
          title: 'Nagisa ジョブ投入',
          description: 'プロバイダと content_id を指定して Nagisa に録画ジョブを直接投入する'
        },
        abema: {
          title: 'ABEMA 鍵アーカイブ',
          description: '復号鍵が未取得の ABEMA 作品を確認し、取得ジョブをキューに投入する'
        },
        logs: {
          title: '同期ログ',
          description: 'cron / Queue バッチの実行履歴と、cron が動いているかを確認する'
        },
        status: {
          title: 'サーバーステータス',
          description: 'Nagisa の稼働状況・キュー・録画台帳と、WebUI 側の同期状態を確認する'
        }
      }
    }
  })
} satisfies Dictionary

export default adminContent
