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
    }
  })
} satisfies Dictionary

export default animeInfoContent
