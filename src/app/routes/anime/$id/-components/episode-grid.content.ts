import { type Dictionary, insert, t } from 'intlayer'

const episodeGridContent = {
  key: 'anime-id-episode-grid',
  content: t({
    ja: {
      recordButton: {
        sending: '送信中',
        pending: '予約済み',
        downloading: '録画中',
        future: '配信予定',
        done: '録画済み',
        retry: '再試行',
        record: '録画する',
        failedTitle: '録画に失敗しました',
        doneTitle: '録画リクエストを再送信します（Nagisa 側で既存のファイルはスキップされます）'
      },
      recordToast: {
        success: insert('{{count}} 話分の録画リクエストを送信しました'),
        acceptedCount: insert('Nagisa が {{count}} 件のリクエストを受け付けました'),
        error: '録画リクエストに失敗しました'
      },
      selectEpisodeLabel: insert('第{{number}}話を選択'),
      selectAllLabel: '表示中のエピソードをすべて選択',
      freeBadge: '無料',
      recordSelected: '選択したエピソードを録画',
      state: {
        todo: '未録画',
        done: '録画済み',
        future: '配信予定',
        pending: '予約済み',
        rec: '録画中',
        fail: '録画に失敗しました'
      },
      episodeLabel: insert('第{{number}}話'),
      subtitlesBadge: '字幕',
      dubBadge: '吹き替え',
      releaseOn: insert('{{date}} 配信'),
      heading: 'エピソード',
      noEpisodes: 'エピソード情報はまだありません',
      seasonTabsLabel: 'シーズン',
      autoRecordOn: '新着エピソードを自動録画',
      autoRecordOff: '自動録画は無効',
      recordingStatusLabel: '録画状況',
      stats: {
        total: '話数',
        done: '録画済み'
      },
      filterFieldsetLabel: '絞り込み',
      filterChips: {
        all: 'すべて',
        todo: '未録画',
        free: '無料'
      },
      orderButton: '話数順',
      footerRecorded: insert('録画済み {{count}} 話'),
      openRecordings: '録画一覧で開く'
    },
    en: {
      recordButton: {
        sending: 'Sending',
        pending: 'Scheduled',
        downloading: 'Recording',
        future: 'Upcoming',
        done: 'Recorded',
        retry: 'Retry',
        record: 'Record',
        failedTitle: 'Recording failed',
        doneTitle: 'Send the recording request again (Nagisa skips existing files)'
      },
      recordToast: {
        success: insert('Recording requests sent for {{count}} ep.'),
        acceptedCount: insert('Requests accepted by Nagisa: {{count}}'),
        error: 'Failed to request recording'
      },
      selectEpisodeLabel: insert('Select episode {{number}}'),
      selectAllLabel: 'Select all visible episodes',
      freeBadge: 'Free',
      recordSelected: 'Record selected episodes',
      state: {
        todo: 'Not recorded',
        done: 'Recorded',
        future: 'Upcoming',
        pending: 'Scheduled',
        rec: 'Recording',
        fail: 'Recording failed'
      },
      episodeLabel: insert('Episode {{number}}'),
      subtitlesBadge: 'Subtitled',
      dubBadge: 'Dubbed',
      releaseOn: insert('Available on {{date}}'),
      heading: 'Episodes',
      noEpisodes: 'No episode information yet',
      seasonTabsLabel: 'Seasons',
      autoRecordOn: 'Automatically record new episodes',
      autoRecordOff: 'Automatic recording is off',
      recordingStatusLabel: 'Recording status',
      stats: {
        total: 'Episodes',
        done: 'Recorded'
      },
      filterFieldsetLabel: 'Filters',
      filterChips: {
        all: 'All',
        todo: 'Not recorded',
        free: 'Free'
      },
      orderButton: 'Episode order',
      footerRecorded: insert('Recorded: {{count}} ep.'),
      openRecordings: 'Open in recordings'
    }
  })
} satisfies Dictionary

export default episodeGridContent
