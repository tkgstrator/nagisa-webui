import { type Dictionary, insert, t } from 'intlayer'

const displaySectionContent = {
  key: 'settings-display-section',
  content: t({
    ja: {
      title: '表示',
      count: '一覧とカードの表示設定',
      pageSizeOption: insert('{{size}} 件'),
      themeOptions: {
        light: 'ライト',
        dark: 'ダーク',
        system: 'システム'
      },
      densityOptions: {
        comfortable: 'ゆったり',
        default: '標準',
        compact: 'コンパクト'
      },
      theme: {
        label: 'テーマ',
        description: '「システム」は OS の外観設定に合わせます。'
      },
      pageSize: {
        label: '1 ページの表示件数',
        description: 'アニメ一覧・録画一覧・未識別タイトル一覧に適用されます。'
      },
      defaultSort: {
        label: '既定の並び順',
        description: 'URL で指定されている場合は、そちらが優先されます。'
      },
      density: {
        label: 'カードの密度',
        description: '1 行あたりのカード数とサムネイルの大きさを変更します。'
      },
      animations: {
        label: 'アニメーション',
        description: 'OS で動きを減らす設定が有効な場合は、この設定にかかわらずアニメーションを抑えます。',
        on: '有効',
        off: '無効'
      }
    },
    en: {
      title: 'Display',
      count: 'List and card appearance',
      pageSizeOption: insert('{{size}} items'),
      themeOptions: {
        light: 'Light',
        dark: 'Dark',
        system: 'System'
      },
      densityOptions: {
        comfortable: 'Comfortable',
        default: 'Default',
        compact: 'Compact'
      },
      theme: {
        label: 'Theme',
        description: "System follows your operating system's appearance settings."
      },
      pageSize: {
        label: 'Items per page',
        description: 'Applies to the anime catalog, recordings, and unmatched titles.'
      },
      defaultSort: {
        label: 'Default sort order',
        description: 'The sort order specified in the URL takes priority.'
      },
      density: {
        label: 'Card density',
        description: 'Changes the number of cards per row and thumbnail size.'
      },
      animations: {
        label: 'Animations',
        description: 'Animations are reduced when your OS has reduced motion enabled, regardless of this setting.',
        on: 'On',
        off: 'Off'
      }
    }
  })
} satisfies Dictionary

export default displaySectionContent
