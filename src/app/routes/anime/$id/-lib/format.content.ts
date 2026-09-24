import { type Dictionary, insert, t } from 'intlayer'

const animeIdFormatContent = {
  key: 'anime-id-format',
  content: t({
    ja: {
      weekday: ['日', '月', '火', '水', '木', '金', '土'],
      hoursMinutes: insert('{{hours}}時間{{minutes}}分'),
      minutes: insert('{{minutes}}分')
    }
  })
} satisfies Dictionary

export default animeIdFormatContent
