import { type Dictionary, t } from 'intlayer'

const adminSectionContent = {
  key: 'settings-admin-section',
  content: t({
    ja: {
      title: '管理',
      moreLabel: '管理画面を開く',
      unidentified: {
        titlePrefix: '未識別タイトル ',
        titleSuffix: ' 件',
        description: 'AniList で照合できなかった作品を確認・修正します。'
      },
      nagisaJob: {
        title: 'Nagisa ジョブ投入',
        description: 'provider / content_id を指定して、ジョブを直接送信します。'
      },
      changelog: {
        title: '変更履歴',
        description: '最近のデプロイとコミットを日付ごとに確認します。'
      }
    },
    en: {
      title: 'Admin',
      moreLabel: 'Open admin',
      unidentified: {
        titlePrefix: 'Unmatched titles: ',
        titleSuffix: '',
        description: 'Review and update titles that could not be matched on AniList.'
      },
      nagisaJob: {
        title: 'Submit Nagisa jobs',
        description: 'Submit jobs directly using provider / content_id.'
      },
      changelog: {
        title: 'Changelog',
        description: 'View recent deployments and commits by date.'
      }
    }
  })
} satisfies Dictionary

export default adminSectionContent
