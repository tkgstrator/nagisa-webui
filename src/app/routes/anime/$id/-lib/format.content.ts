import { type Dictionary, insert, t } from 'intlayer'

const animeIdFormatContent = {
  key: 'anime-id-format',
  content: t({
    ja: {
      weekday: ['日', '月', '火', '水', '木', '金', '土'],
      hoursMinutes: insert('{{hours}}時間{{minutes}}分'),
      minutes: insert('{{minutes}}分')
    },
    en: {
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      hoursMinutes: insert('{{hours}} hr {{minutes}} min'),
      minutes: insert('{{minutes}} min')
    }
  })
} satisfies Dictionary

export default animeIdFormatContent
