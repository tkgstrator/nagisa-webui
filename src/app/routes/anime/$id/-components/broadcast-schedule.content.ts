import { type Dictionary, insert, t } from 'intlayer'

const broadcastScheduleContent = {
  key: 'anime-id-broadcast-schedule',
  content: t({
    ja: {
      heading: '放送スケジュール',
      episodeLabel: insert('第{{number}}話'),
      thisWeekSuffix: ' (今週)',
      finalEpisode: insert('最終話 (全{{count}}話)')
    }
  })
} satisfies Dictionary

export default broadcastScheduleContent
