import { type Dictionary, t } from 'intlayer'

const aboutSectionContent = {
  key: 'settings-about-section',
  content: t({
    ja: {
      title: 'アプリ情報',
      changelogLabel: '変更履歴',
      meta: {
        version: 'バージョン',
        build: 'ビルド',
        animeCount: '登録作品',
        scheduledCount: '録画予約'
      }
    }
  })
} satisfies Dictionary

export default aboutSectionContent
