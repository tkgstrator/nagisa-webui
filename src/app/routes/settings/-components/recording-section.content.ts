import { type Dictionary, insert, t } from 'intlayer'

const recordingSectionContent = {
  key: 'settings-recording-section',
  content: t({
    ja: {
      title: '録画',
      count: 'Nagisa への依頼と予約のふるまい',
      leadDayOption: insert('{{days}} 日前から'),
      requestOnMark: {
        label: '録画済みにしたら録画も依頼する',
        description: '詳細画面で「録画済み」を ON にしたとき、Nagisa へ録画リクエストも送る。',
        on: '依頼する',
        off: '依頼しない'
      },
      confirmBulkCancel: {
        label: '一括解除の前に確認する',
        description: '録画一覧で複数まとめて予約解除するとき、確認を挟む。',
        on: '確認する',
        off: '確認しない'
      },
      expiringLeadDays: {
        label: '配信終了の予告',
        description: 'この日数を切った予約作品に「配信終了予定」のバッジを出す。'
      },
      autoSchedule: {
        label: '新着エピソードを自動で予約する',
        description: '予約中の作品に新しい話数が来たら、確認せずに録画を依頼する。',
        on: '自動',
        off: '手動'
      },
      defaultLanguage: {
        label: '既定の言語',
        description: 'ジョブ投入フォームの language に初期値として入る。'
      }
    }
  })
} satisfies Dictionary

export default recordingSectionContent
