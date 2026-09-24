import { type Dictionary, t } from 'intlayer'

const constantsContent = {
  key: 'constants',
  content: t({
    ja: {
      provider: {
        amazon: 'Prime Video',
        hulu: 'Hulu',
        crunchyroll: 'Crunchyroll',
        abema: 'ABEMA',
        netflix: 'Netflix'
      },
      status: {
        FINISHED: '完結',
        RELEASING: '放送中',
        NOT_YET_RELEASED: '未放送',
        CANCELLED: '中止',
        HIATUS: '休止'
      },
      recordStatusLabel: {
        none: '未指示',
        pending: '待機中',
        downloading: 'ダウンロード中',
        completed: '録画済み',
        failed: '失敗',
        stale: '見失い',
        missing: '実体なし'
      },
      recordStatusNote: {
        none: '録画を指示していない',
        pending: '指示は通ったがキューで順番待ち',
        downloading: 'キューで実行中',
        completed: '台帳に実体を確認済み',
        failed: 'キューが失敗として終えた',
        stale: '30 分キューに現れず見失った (失敗とは限らない)',
        missing: '台帳から実体が消えた'
      }
    }
  })
} satisfies Dictionary

export default constantsContent
