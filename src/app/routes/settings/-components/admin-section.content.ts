import { type Dictionary, t } from 'intlayer'

const adminSectionContent = {
  key: 'settings-admin-section',
  content: t({
    ja: {
      title: '管理',
      moreLabel: '管理ハブを開く',
      unidentified: {
        titlePrefix: '未識別タイトル ',
        titleSuffix: ' 件',
        description: 'AniList で照合できなかった作品を手当てする'
      },
      nagisaJob: {
        title: 'Nagisa ジョブ投入',
        description: 'provider / content_id を指定して直接依頼する'
      },
      changelog: {
        title: '変更履歴',
        description: '直近のデプロイとコミットを日付ごとに見る'
      }
    }
  })
} satisfies Dictionary

export default adminSectionContent
