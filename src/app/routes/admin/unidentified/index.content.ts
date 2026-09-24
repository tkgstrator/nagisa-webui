import { type Dictionary, insert, t } from 'intlayer'

const adminUnidentifiedContent = {
  key: 'admin-unidentified',
  content: t({
    ja: {
      title: '未識別タイトル一覧',
      unresolvedCount: insert('AniList で識別できなかった {{total}} 件のタイトル'),
      filterAll: 'すべて',
      providerFilterLabel: 'プロバイダ',
      sortButton: {
        prefix: '更新日',
        desc: '新しい順',
        asc: '古い順'
      },
      emptyState: '該当するタイトルはありません',
      updatedPrefix: '更新'
    }
  })
} satisfies Dictionary

export default adminUnidentifiedContent
