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
        yearDesc: '放送年が新しい順',
        yearAsc: '放送年が古い順'
      },
      ariaLabels: {
        filterAndSort: '絞り込みと並べ替え',
        recordedStatus: '録画状態',
        provider: 'プロバイダ'
      },
      expiringOnly: '配信終了予定のみ',
      reset: '条件をリセット',
      sortLabel: '並べ替え'
    }
  })
} satisfies Dictionary

export default recordingsToolbarContent
