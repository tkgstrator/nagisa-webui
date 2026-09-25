import { type Dictionary, insert, t } from 'intlayer'

const adminUnidentifiedContent = {
  key: 'admin-unidentified',
  content: t({
    ja: {
      title: '未識別タイトル一覧',
      unresolvedCount: insert('AniList で照合できなかった {{total}} 件の作品'),
      filterAll: 'すべて',
      providerFilterLabel: '配信元',
      sortButton: {
        prefix: '更新日',
        desc: '新しい順',
        asc: '古い順'
      },
      emptyState: '該当するタイトルはありません',
      updatedPrefix: '更新'
    },
    en: {
      title: 'Unmatched titles',
      unresolvedCount: insert('Titles not matched on AniList: {{total}}'),
      filterAll: 'All',
      providerFilterLabel: 'Provider',
      sortButton: {
        prefix: 'Updated',
        desc: 'Newest first',
        asc: 'Oldest first'
      },
      emptyState: 'No matching titles',
      updatedPrefix: 'Updated'
    }
  })
} satisfies Dictionary

export default adminUnidentifiedContent
