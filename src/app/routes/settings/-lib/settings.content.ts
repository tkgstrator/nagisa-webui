import { type Dictionary, insert, t } from 'intlayer'

const settingsContent = {
  key: 'settings-settings',
  content: t({
    ja: {
      sortLabels: {
        titleAsc: 'タイトル (昇順)',
        titleDesc: 'タイトル (降順)',
        yearAsc: '放送年 (古い順)',
        yearDesc: '放送年 (新しい順)'
      },
      languageLabels: {
        sub: '字幕 (sub)',
        dub: '吹き替え (dub)'
      },
      quarterLabels: ['冬', '春', '夏', '秋'],
      seasonFormat: insert('{{year}}年 {{quarter}}')
    },
    en: {
      sortLabels: {
        titleAsc: 'Title (ascending)',
        titleDesc: 'Title (descending)',
        yearAsc: 'Release year (oldest first)',
        yearDesc: 'Release year (newest first)'
      },
      languageLabels: {
        sub: 'Subtitled (sub)',
        dub: 'Dubbed (dub)'
      },
      quarterLabels: ['Winter', 'Spring', 'Summer', 'Fall'],
      seasonFormat: insert('{{quarter}} {{year}}')
    }
  })
} satisfies Dictionary

export default settingsContent
