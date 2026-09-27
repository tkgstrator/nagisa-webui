import { type Dictionary, insert, t } from 'intlayer'

const notFoundPageContent = {
  key: 'not-found-page',
  content: t({
    ja: {
      meta: {
        request: 'リクエスト',
        requestValue: insert('GET {{pathname}}'),
        animeId: '作品 ID',
        occurredAt: '発生時刻'
      },
      anime: {
        title: 'この作品は見つかりませんでした',
        description:
          '指定された ID に一致する作品がデータベースにありません。削除されたか、URL が間違っている可能性があります。',
        causes: [
          '作品が削除され、参照だけが残っている',
          '古いブックマークや共有リンクから開いた',
          'URL の ID を手で書き換えた'
        ]
      },
      page: {
        title: 'ページが見つかりません',
        description: 'お探しのページは存在しないか、移動した可能性があります。URL をご確認ください。',
        causes: ['URL を打ち間違えた', 'ページが移動または削除された', '古いブックマークや共有リンクから開いた']
      },
      causesTitle: '考えられる原因',
      nextTitle: '次にできること',
      next: {
        browse: {
          title: 'アニメ一覧から探す',
          description: '登録済みの作品をすべて表示します'
        },
        recordings: {
          title: '録画を確認する',
          description: '予約済み・録画済みの一覧を表示します'
        },
        home: {
          title: 'ホームに戻る',
          description: '今期の更新状況を確認します'
        }
      }
    },
    en: {
      meta: {
        request: 'Request',
        requestValue: insert('GET {{pathname}}'),
        animeId: 'Anime ID',
        occurredAt: 'Occurred at'
      },
      anime: {
        title: 'Anime not found',
        description:
          'No anime with this ID exists in the database. It may have been deleted, or the URL may be incorrect.',
        causes: [
          'The anime was deleted, but a link to it remains',
          'You followed an outdated bookmark or shared link',
          'The ID in the URL was edited manually'
        ]
      },
      page: {
        title: 'Page not found',
        description: 'The page does not exist or may have moved. Please check the URL.',
        causes: [
          'The URL contains a typo',
          'The page was moved or deleted',
          'You followed an outdated bookmark or shared link'
        ]
      },
      causesTitle: 'Possible causes',
      nextTitle: 'What you can do next',
      next: {
        browse: {
          title: 'Browse anime',
          description: 'View all anime in the catalog'
        },
        recordings: {
          title: 'View recordings',
          description: 'View scheduled and recorded anime'
        },
        home: {
          title: 'Back to home',
          description: 'Check updates for the current season'
        }
      }
    }
  })
} satisfies Dictionary

export default notFoundPageContent
