import { type Dictionary, t } from 'intlayer'

const appSidebarContent = {
  key: 'app-sidebar',
  content: t({
    ja: {
      navAriaLabel: 'メインナビゲーション',
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
    },
    en: {
      navAriaLabel: 'Main navigation',
      nav: {
        home: 'Home',
        browse: 'Browse anime',
        recordings: 'Recordings',
        settings: 'Settings'
      },
      status: {
        connecting: 'Checking connection',
        down: 'Server offline',
        up: 'Server online'
      }
    }
  })
} satisfies Dictionary

export default appSidebarContent
