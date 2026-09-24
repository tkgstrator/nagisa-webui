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
        doneTitle: '押すと録画をもう一度送る (nagisa 側で既存ファイルは飛ばされる)'
      },
      episodeLabel: insert('第{{number}}話'),
      selectEpisodeLabel: insert('第{{number}}話を選択'),
      freeBadge: '無料',
      subtitlesBadge: '字幕',
      dubBadge: '吹替',
      releaseOn: insert('{{date}} 配信'),
      recordToast: {
        success: insert('{{count}} 話の録画を送信しました'),
        acceptedCount: insert('nagisa が受け付けたのは {{count}} 件'),
        error: '録画リクエストに失敗しました'
      },
      heading: 'エピソード',
      noEpisodes: 'エピソード情報はまだありません',
      seasonTabsLabel: 'シーズン',
      autoRecordOn: '新着エピソードを自動録画',
      autoRecordOff: '自動録画は無効',
      recordingStatusLabel: '録画状況',
      stats: {
        done: '録画済み',
        todo: '未録画',
        future: '配信予定'
      },
      filterFieldsetLabel: '絞り込み',
      selectAllLabel: '表示中の話をすべて選択',
      filterChips: {
        all: 'すべて',
        todo: '未録画',
        free: '無料'
      },
      recordSelected: '選択した話を録画',
      orderButton: '話数順',
      footerRecorded: insert('録画済み {{count}} 話'),
      openRecordings: '録画一覧で開く'
    }
  })
} satisfies Dictionary

export default episodeGridContent
