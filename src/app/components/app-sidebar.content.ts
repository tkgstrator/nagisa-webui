import { type Dictionary, t } from 'intlayer'

const appSidebarContent = {
  key: 'app-sidebar',
  content: t({
    ja: {
      navAriaLabel: 'メイン',
      nav: {
        home: 'ホーム',
        browse: 'アニメ一覧',
        recordings: '録画一覧',
        settings: '設定'
      },
      status: {
        connecting: '接続を確認中',
        down: 'サーバー停止中',
        up: 'サーバー稼働中'
      }
    }
  })
} satisfies Dictionary

export default appSidebarContent
