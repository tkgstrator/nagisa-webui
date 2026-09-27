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
    },
    en: {
      relative: {
        now: 'Just now',
        minutesAgo: insert('{{count}} min ago'),
        hoursAgo: insert('{{count}} hr ago'),
        daysAgo: insert('{{count}} d ago'),
        weeksAgo: insert('{{count}} wk ago'),
        monthsAgo: insert('{{count}} mo ago'),
        yearsAgo: insert('{{count}} yr ago')
      },
      year: insert('{{year}}'),
      yearWithQuarter: insert('{{quarter}} {{year}}')
    }
  })
} satisfies Dictionary

export default formatContent
