import { type Dictionary, t } from 'intlayer'

const recordingsToolbarContent = {
  key: 'recordings-recordings-toolbar',
  content: t({
    ja: {
      recordedOptions: {
        all: 'すべて',
        pending: '未録画',
        recorded: '録画済み'
      },
      sortOptions: {
        updatedDesc: '最終更新が新しい順',
        updatedAsc: '最終更新が古い順',
        titleAsc: 'タイトル順',
        yearDesc: '放送年 (新しい順)',
        yearAsc: '放送年 (古い順)'
      },
      ariaLabels: {
        filterAndSort: '絞り込みと並べ替え',
        recordedStatus: '録画状態',
        provider: '配信元'
      },
      expiringOnly: '配信終了予定のみ',
      reset: '絞り込みをリセット',
      sortLabel: '並べ替え'
    },
    en: {
      recordedOptions: {
        all: 'All',
        pending: 'Not recorded',
        recorded: 'Recorded'
      },
      sortOptions: {
        updatedDesc: 'Last updated (newest first)',
        updatedAsc: 'Last updated (oldest first)',
        titleAsc: 'Title',
        yearDesc: 'Release year (newest first)',
        yearAsc: 'Release year (oldest first)'
      },
      ariaLabels: {
        filterAndSort: 'Filter and sort',
        recordedStatus: 'Recording status',
        provider: 'Provider'
      },
      expiringOnly: 'Leaving soon only',
      reset: 'Reset filters',
      sortLabel: 'Sort'
    }
  })
} satisfies Dictionary

export default recordingsToolbarContent
