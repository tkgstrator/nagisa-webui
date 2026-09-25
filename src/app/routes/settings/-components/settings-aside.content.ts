import { type Dictionary, t } from 'intlayer'

const settingsAsideContent = {
  key: 'settings-settings-aside',
  content: t({
    ja: {
      sections: {
        view: '表示',
        provider: '配信元',
        rec: '録画',
        sync: '台帳同期',
        admin: '管理',
        data: 'データ',
        about: 'アプリ情報'
      },
      navAriaLabel: '設定のセクション',
      sectionsHeading: 'このページの内容',
      localOnly: {
        lead: 'この画面の設定は',
        scope: 'このブラウザにのみ',
        body: '保存されます。別の端末やシークレットウィンドウには引き継がれません。移行するには、',
        dataLabel: 'データ',
        tail: 'の「書き出す」を使用してください。'
      }
    },
    en: {
      sections: {
        view: 'Display',
        provider: 'Providers',
        rec: 'Recordings',
        sync: 'Library sync',
        admin: 'Admin',
        data: 'Data',
        about: 'About'
      },
      navAriaLabel: 'Settings sections',
      sectionsHeading: 'On this page',
      localOnly: {
        lead: 'These settings are stored ',
        scope: 'only in this browser',
        body: '. They are not shared with other devices or private browsing windows. To transfer them, open ',
        dataLabel: 'Data',
        tail: ' and select Export.'
      }
    }
  })
} satisfies Dictionary

export default settingsAsideContent
