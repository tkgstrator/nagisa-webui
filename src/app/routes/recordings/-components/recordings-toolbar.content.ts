import { type Dictionary, t } from 'intlayer'

const recordingsToolbarContent = {
  key: 'recordings-recordings-toolbar',
  content: t({
    ja: {
      sortOptions: {
        updated: '最終更新',
        title: 'タイトル',
        year: '放送年'
      },
      ariaLabels: {
        filterAndSort: '絞り込みと並べ替え',
        provider: '配信元'
      },
      allProviders: '全配信元',
      expiringOnly: '配信終了予定のみ',
      showFinished: '完結も表示',
      reset: '絞り込みをリセット',
      sortLabel: '並べ替え'
    },
    en: {
      sortOptions: {
        updated: 'Last updated',
        title: 'Title',
        year: 'Release year'
      },
      ariaLabels: {
        filterAndSort: 'Filter and sort',
        provider: 'Provider'
      },
      allProviders: 'All providers',
      expiringOnly: 'Leaving soon only',
      showFinished: 'Show finished',
      reset: 'Reset filters',
      sortLabel: 'Sort'
    }
  })
} satisfies Dictionary

export default recordingsToolbarContent
