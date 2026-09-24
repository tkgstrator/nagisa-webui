import { type Dictionary, insert, t } from 'intlayer'

const displaySectionContent = {
  key: 'settings-display-section',
  content: t({
    ja: {
      title: '表示',
      count: '一覧とカードの見え方',
      pageSizeOption: insert('{{size}} 件'),
      themeOptions: {
        light: 'ライト',
        dark: 'ダーク',
        system: 'システム'
      },
      densityOptions: {
        comfortable: 'ゆったり',
        default: '標準',
        compact: '詰める'
      },
      theme: {
        label: 'テーマ',
        description: '「システム」は OS の外観設定に追従する。'
      },
      pageSize: {
        label: '1 ページの表示件数',
        description: 'アニメ一覧・録画一覧・未識別タイトルに適用される。'
      },
      defaultSort: {
        label: '既定の並び順',
        description: 'URL に指定があればそちらが優先される。'
      },
      density: {
        label: 'カードの密度',
        description: '1 行あたりの枚数とサムネイルの大きさが変わる。'
      },
      animations: {
        label: 'アニメーション',
        description: 'OS で「視差を減らす」が有効なときは、この設定によらず抑制される。',
        on: '有効',
        off: '無効'
      }
    }
  })
} satisfies Dictionary

export default displaySectionContent
