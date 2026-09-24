import { type Dictionary, insert, t } from 'intlayer'

const formatContent = {
  key: 'recordings-format',
  content: t({
    ja: {
      relative: {
        now: 'たった今',
        minutesAgo: insert('{{count}} 分前'),
        hoursAgo: insert('{{count}} 時間前'),
        daysAgo: insert('{{count}} 日前'),
        weeksAgo: insert('{{count}} 週間前'),
        monthsAgo: insert('{{count}} か月前'),
        yearsAgo: insert('{{count}} 年前')
      },
      year: insert('{{year}}年'),
      yearWithQuarter: insert('{{year}}年 {{quarter}}')
    }
  })
} satisfies Dictionary

export default formatContent
