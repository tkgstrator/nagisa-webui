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
        dub: '吹き替え (dub)'
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
        suffix: 'に録画ジョブを直接送信します。'
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
      episodesHint: 'カンマ・スペース・改行で区切って入力してください。season_number の指定も必要です。',
      forceHint: {
        prefix: '— 出力ファイルが存在する場合も、スキップせずに再ダウンロードします（Nagisa の',
        suffix: 'に相当）'
      },
      submit: '投入',
      submitting: '送信中…',
      previewTitle: '送信内容プレビュー',
      errorTitle: 'エラー',
      jobPreviewMeta: insert('{{contentType}} ・ {{selected}} / {{total}} 話 ・ {{marketplace}}'),
      responseTitle: 'レスポンス全体',
      enqueuedCount: insert('{{count}} 件のジョブを投入しました')
    },
    en: {
      marketplaces: {
        jp: 'Japan (jp)',
        us: 'United States (us)'
      },
      languages: {
        sub: 'Subtitled (sub)',
        dub: 'Dubbed (dub)'
      },
      unset: 'Not specified',
      validation: {
        episodeNumberInvalid: insert('Episode number must be a positive integer: "{{value}}"'),
        seasonNumberInvalid: insert('season_number must be a positive integer: "{{value}}"'),
        contentIdRequired: 'Enter a content_id',
        episodesRequireSeasonNumber: 'Specify season_number when providing episodes'
      },
      title: 'Submit Nagisa jobs',
      description: {
        prefix: "Submit recording jobs to Nagisa's",
        suffix: 'endpoint through the backend.'
      },
      labels: {
        seasonNumber: 'season_number (optional; leave blank for all seasons)',
        episodes: 'episodes (optional; leave blank for all episodes)',
        marketplace: 'marketplace (optional)',
        language: 'language (optional)'
      },
      placeholders: {
        contentId: 'e.g. B0DXV9MP4Y or lycoris-recoil',
        seasonNumber: 'e.g. 1',
        episodes: 'e.g. 1, 2, 3'
      },
      episodesHint: 'Separate with commas, spaces, or line breaks. Requires season_number.',
      forceHint: {
        prefix: "— Download again even if output files exist (equivalent to Nagisa's",
        suffix: 'flag)'
      },
      submit: 'Submit',
      submitting: 'Sending…',
      previewTitle: 'Request preview',
      errorTitle: 'Error',
      jobPreviewMeta: insert('{{contentType}} · {{selected}} / {{total}} episodes · {{marketplace}}'),
      responseTitle: 'Full response',
      enqueuedCount: insert('Jobs submitted: {{count}}')
    }
  })
} satisfies Dictionary

export default adminNagisaContent
