import { type Dictionary, insert, t } from 'intlayer'

const adminNagisaContent = {
  key: 'admin-nagisa',
  content: t({
    ja: {
      marketplaces: {
        jp: '日本 (jp)',
        us: '米国 (us)'
      },
      languages: {
        sub: '字幕 (sub)',
        dub: '吹替 (dub)'
      },
      unset: '未指定',
      validation: {
        episodeNumberInvalid: insert('エピソード番号は正の整数で指定してください: "{{value}}"'),
        seasonNumberInvalid: insert('season_number は正の整数で指定してください: "{{value}}"'),
        contentIdRequired: 'content_id を入力してください',
        episodesRequireSeasonNumber: 'episodes を指定する場合は season_number も指定してください'
      },
      title: 'Nagisa ジョブ投入',
      description: {
        prefix: 'バックエンド経由で Nagisa の',
        suffix: 'に録画ジョブを直接投入する'
      },
      labels: {
        seasonNumber: 'season_number（任意・空欄で全シーズン）',
        episodes: 'episodes（任意・空欄で全話）',
        marketplace: 'marketplace（任意）',
        language: 'language（任意）'
      },
      placeholders: {
        contentId: '例: B0DXV9MP4Y / lycoris-recoil など',
        seasonNumber: '例: 1',
        episodes: '例: 1, 2, 3'
      },
      episodesHint: 'カンマ・スペース・改行区切り。season_number と併用。',
      forceHint: {
        prefix: '— 既存の出力ファイルがあってもスキップせず再ダウンロードする (Nagisa の',
        suffix: '相当)'
      },
      submit: '投入',
      submitting: '送信中…',
      previewTitle: '送信内容プレビュー',
      errorTitle: 'エラー',
      jobPreviewMeta: insert('{{contentType}} ・ {{selected}} / {{total}} 話 ・ {{marketplace}}'),
      responseTitle: 'レスポンス全体',
      enqueuedCount: insert('{{count}} 件のジョブを投入しました')
    }
  })
} satisfies Dictionary

export default adminNagisaContent
