import { type Dictionary, insert, t } from 'intlayer'

const settingsContent = {
  key: 'settings-settings',
  content: t({
    ja: {
      sortLabels: {
        title: 'タイトル',
        year: '放送年'
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
        title: 'Title',
        year: 'Release year'
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
