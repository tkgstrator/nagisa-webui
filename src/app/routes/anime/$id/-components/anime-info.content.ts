import { type Dictionary, t } from 'intlayer'

const animeInfoContent = {
  key: 'anime-id-anime-info',
  content: t({
    ja: {
      heading: '作品情報',
      rows: {
        aniList: 'AniList',
        provider: '配信元',
        expiredAt: '配信終了',
        updatedAt: '最終更新',
        contentId: '識別子'
      }
    },
    en: {
      heading: 'Anime details',
      rows: {
        aniList: 'AniList',
        provider: 'Provider',
        expiredAt: 'Available until',
        updatedAt: 'Last updated',
        contentId: 'Identifier'
      }
    }
  })
} satisfies Dictionary

export default animeInfoContent
