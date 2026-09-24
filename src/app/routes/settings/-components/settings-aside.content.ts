import { type Dictionary, t } from 'intlayer'

const settingsAsideContent = {
  key: 'settings-settings-aside',
  content: t({
    ja: {
      sections: {
        view: '表示',
        provider: '配信プロバイダ',
        rec: '録画',
        sync: '台帳同期',
        admin: '管理',
        data: 'データ',
        about: 'アプリ情報'
      },
      navAriaLabel: '設定の節',
      sectionsHeading: 'この画面の中身',
      localOnly: {
        lead: 'ここの設定は',
        scope: 'このブラウザにだけ',
        body: '保存される。別の端末やシークレットウィンドウには引き継がれない。持ち運ぶときは',
        dataLabel: 'データ',
        tail: 'の「書き出す」を使う。'
      }
    }
  })
} satisfies Dictionary

export default settingsAsideContent
