import { type Dictionary, t } from 'intlayer'

const errorPageContent = {
  key: 'error-page',
  content: t({
    ja: {
      meta: {
        request: 'リクエスト',
        status: 'ステータス',
        occurredAt: '発生時刻'
      },
      variants: {
        network: {
          title: 'サーバーに接続できません',
          description:
            'ネットワークに接続されていないか、サーバーに到達できませんでした。接続を確認してから再度お試しください。',
          statusValue: '応答なし'
        },
        notFound: {
          title: 'ページが見つかりません',
          description: 'お探しのページは存在しないか、移動した可能性があります。'
        },
        unavailable: {
          title: '一時的に利用できません',
          description: 'メンテナンス中か、アクセスが集中しています。時間をおいてから再度お試しください。'
        },
        gateway: {
          title: 'サーバーの応答がありません',
          description: '上流のサーバーが応答しませんでした。時間をおいてから再度お試しください。'
        },
        generic: {
          title: 'データの取得に失敗しました',
          description:
            'サーバー側で予期しないエラーが発生しました。データは失われていません。しばらく待ってから再読み込みしてください。'
        }
      },
      actions: {
        reload: '再読み込み',
        home: 'ホームに戻る'
      },
      details: '技術的な詳細'
    }
  })
} satisfies Dictionary

export default errorPageContent
