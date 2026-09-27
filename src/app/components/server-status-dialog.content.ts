import { type Dictionary, insert, t } from 'intlayer'

const serverStatusDialogContent = {
  key: 'server-status-dialog',
  content: t({
    ja: {
      connecting: '接続中…',
      offline: 'オフライン',
      cannotReach: 'Nagisa サーバーに接続できません',
      online: 'オンライン',
      uptime: insert('稼働時間: {{time}}'),
      queue: { wait: '待機', active: '実行中', done: '完了', fail: '失敗', delay: '遅延' },
      activeJobs: insert('実行中のジョブ ({{count}})'),
      redis: { status: '状態', connected: '接続中', disconnected: '未接続', memory: 'メモリ', uptime: '稼働時間' },
      system: 'システム'
    },
    en: {
      connecting: 'Connecting…',
      offline: 'Offline',
      cannotReach: 'Cannot reach Nagisa server',
      online: 'Online',
      uptime: insert('Uptime: {{time}}'),
      queue: { wait: 'Wait', active: 'Active', done: 'Done', fail: 'Fail', delay: 'Delay' },
      activeJobs: insert('Active jobs ({{count}})'),
      redis: {
        status: 'Status',
        connected: 'Connected',
        disconnected: 'Disconnected',
        memory: 'Memory',
        uptime: 'Uptime'
      },
      system: 'System'
    }
  })
} satisfies Dictionary

export default serverStatusDialogContent
