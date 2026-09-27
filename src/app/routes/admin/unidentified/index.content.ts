import { type Dictionary, t } from 'intlayer'

const adminUnidentifiedContent = {
  key: 'admin-unidentified',
  content: t({
    ja: {
      eyebrow: '管理',
      title: '未識別タイトル一覧',
      unresolvedCount: {
        prefix: 'AniList で照合できなかった',
        suffix: '件の作品'
      },
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
      eyebrow: 'Admin',
      title: 'Unmatched titles',
      unresolvedCount: {
        prefix: 'Titles not matched on AniList:',
        suffix: ''
      },
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
