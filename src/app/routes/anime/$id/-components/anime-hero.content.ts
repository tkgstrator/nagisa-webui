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
        perEpisode: '1 話あたり',
        perEpisodeValue: insert('約{{duration}}'),
        totalDuration: '総再生時間'
      },
      scheduleButton: {
        scheduled: '録画予約中',
        schedule: '録画を予約'
      },
      recordButton: {
        recorded: insert('録画済み ({{count}} 話)'),
        recordNow: '今すぐ録画',
        recordedTitle: '録画済みの取り消しには対応していません'
      },
      refreshButton: '再取得'
    },
    en: {
      movieBadge: 'Movie',
      facts: {
        broadcast: 'Broadcast',
        broadcastYear: insert('{{quarter}} {{year}}'),
        unknown: 'Unknown',
        episodeCount: 'Episodes',
        episodeCountValue: insert('Episodes: {{count}}'),
        perEpisode: 'Per episode',
        perEpisodeValue: insert('Approx. {{duration}}'),
        totalDuration: 'Total runtime'
      },
      scheduleButton: {
        scheduled: 'Scheduled',
        schedule: 'Schedule recording'
      },
      recordButton: {
        recorded: insert('Recorded ({{count}} ep.)'),
        recordNow: 'Record now',
        recordedTitle: 'Marking recordings as unrecorded is not supported'
      },
      refreshButton: 'Refresh'
    }
  })
} satisfies Dictionary

export default animeHeroContent
