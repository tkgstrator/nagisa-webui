import { type Dictionary, insert, t } from 'intlayer'

const recordingSectionContent = {
  key: 'settings-recording-section',
  content: t({
    ja: {
      title: '録画',
      count: 'Nagisa へのリクエストと録画予約の設定',
      leadDayOption: insert('{{days}} 日前から'),
      requestOnMark: {
        label: '録画済みにするときに録画もリクエストする',
        description: '詳細画面で「録画済み」をオンにすると、Nagisa に録画リクエストも送信します。',
        on: 'リクエストする',
        off: 'リクエストしない'
      },
      confirmBulkCancel: {
        label: '予約の一括解除前に確認する',
        description: '録画一覧で複数の予約をまとめて解除するときに、確認画面を表示します。',
        on: '確認する',
        off: '確認しない'
      },
      expiringLeadDays: {
        label: '配信終了の事前通知',
        description: '配信終了までの残り日数がこの日数を下回る予約作品に、「配信終了予定」バッジを表示します。'
      },
      autoSchedule: {
        label: '新着エピソードを自動で予約する',
        description: '予約中の作品に新しいエピソードが追加されると、確認せずに録画をリクエストします。',
        on: '自動',
        off: '手動'
      },
      defaultLanguage: {
        label: '既定の言語',
        description: 'ジョブ送信フォームの language の初期値に使用します。'
      }
    },
    en: {
      title: 'Recordings',
      count: 'Nagisa requests and recording schedules',
      leadDayOption: insert('{{days}} d before'),
      requestOnMark: {
        label: 'Request recording when marked as recorded',
        description: 'Send a recording request to Nagisa when Recorded is enabled on the details page.',
        on: 'Send request',
        off: 'Do not send'
      },
      confirmBulkCancel: {
        label: 'Confirm before cancelling multiple schedules',
        description: 'Ask for confirmation before cancelling multiple schedules in the recordings list.',
        on: 'Ask',
        off: 'Do not ask'
      },
      expiringLeadDays: {
        label: 'Leaving soon notice',
        description: 'Show a Leaving soon badge on scheduled titles with fewer than this many days remaining.'
      },
      autoSchedule: {
        label: 'Automatically schedule new episodes',
        description: 'Request recording without confirmation when new episodes of scheduled anime become available.',
        on: 'Automatic',
        off: 'Manual'
      },
      defaultLanguage: {
        label: 'Default language',
        description: 'Used as the default value for language in the job submission form.'
      }
    }
  })
} satisfies Dictionary

export default recordingSectionContent
