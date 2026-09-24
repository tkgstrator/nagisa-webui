import { type Dictionary, insert, t } from 'intlayer'

const animeHeroContent = {
  key: 'anime-id-anime-hero',
  content: t({
    ja: {
      movieBadge: '映画',
      facts: {
        broadcast: '放送',
        broadcastYear: insert('{{year}}年 {{quarter}}'),
        unknown: '不明',
        episodeCount: '話数',
        episodeCountValue: insert('{{count}}話'),
        perEpisode: '1話あたり',
        perEpisodeValue: insert('約{{duration}}'),
        totalDuration: '総再生時間'
      },
      scheduleButton: {
        scheduled: '録画予約中',
        schedule: '録画を予約'
      },
      recordButton: {
        recorded: insert('録画済み ({{count}}話)'),
        recordNow: '今すぐ録画',
        recordedTitle: '録画済みの取り消しには対応していない'
      },
      refreshButton: '再取得'
    }
  })
} satisfies Dictionary

export default animeHeroContent
