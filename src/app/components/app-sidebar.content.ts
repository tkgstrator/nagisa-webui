import { type Dictionary, insert, t } from 'intlayer'

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
        connecting: '接続中',
        offline: 'オフライン',
        failed: insert('{{count}} 件 失敗'),
        active: insert('{{count}} 件 実行中')
      }
    }
  })
} satisfies Dictionary

export default appSidebarContent
