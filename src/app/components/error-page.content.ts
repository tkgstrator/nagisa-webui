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
    },
    en: {
      meta: {
        request: 'Request',
        status: 'Status',
        occurredAt: 'Occurred at'
      },
      variants: {
        network: {
          title: 'Cannot connect to the server',
          description: 'You may be offline, or the server could not be reached. Check your connection and try again.',
          statusValue: 'No response'
        },
        notFound: {
          title: 'Page not found',
          description: 'The page you are looking for does not exist or may have moved.'
        },
        unavailable: {
          title: 'Temporarily unavailable',
          description: 'The service may be under maintenance or experiencing heavy traffic. Please try again later.'
        },
        gateway: {
          title: 'The server is not responding',
          description: 'The upstream server did not respond. Please try again later.'
        },
        generic: {
          title: 'Failed to load data',
          description:
            'An unexpected server error occurred. Your data has not been lost. Please wait a moment and reload.'
        }
      },
      actions: {
        reload: 'Reload',
        home: 'Back to home'
      },
      details: 'Technical details'
    }
  })
} satisfies Dictionary

export default errorPageContent
