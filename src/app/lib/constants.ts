import type { RecordStatus } from '@/schemas/recording.dto'

export const providerLabel: Record<string, string> = {
  amazon: 'Prime Video',
  hulu: 'Hulu',
  crunchyroll: 'Crunchyroll',
  abema: 'ABEMA',
  netflix: 'Netflix'
}

export const providerColor: Record<string, string> = {
  amazon: 'bg-brand-amazon text-brand-amazon-foreground',
  hulu: 'bg-brand-hulu text-brand-hulu-foreground',
  crunchyroll: 'bg-brand-crunchyroll text-brand-crunchyroll-foreground',
  abema: 'bg-brand-abema text-brand-abema-foreground',
  netflix: 'bg-brand-netflix text-brand-netflix-foreground'
}

export const statusLabel: Record<string, string> = {
  FINISHED: '完結',
  RELEASING: '放送中',
  NOT_YET_RELEASED: '未放送',
  CANCELLED: '中止',
  HIATUS: '休止'
}

export const statusColor: Record<string, string> = {
  FINISHED: 'bg-status-finished text-status-finished-foreground',
  RELEASING: 'bg-status-releasing text-status-releasing-foreground',
  NOT_YET_RELEASED: 'bg-status-not-yet text-status-not-yet-foreground',
  CANCELLED: 'bg-status-cancelled text-status-cancelled-foreground',
  HIATUS: 'bg-status-hiatus text-status-hiatus-foreground'
}

/**
 * `episodes.record_status` の表示名。`Record<RecordStatus, string>` にしてあるので、
 * 状態を増やしたらここを埋めるまで型が通らない (画面に生の英字が漏れない)。
 */
export const recordStatusLabel: Record<RecordStatus, string> = {
  none: '未指示',
  pending: '待機中',
  downloading: 'ダウンロード中',
  completed: '録画済み',
  failed: '失敗',
  stale: '見失い',
  missing: '実体なし'
}

/** 各状態が「誰がどう書いたものか」。状態が増えたときの意味を画面に残しておく。 */
export const recordStatusNote: Record<RecordStatus, string> = {
  none: '録画を指示していない',
  pending: '指示は通ったがキューで順番待ち',
  downloading: 'キューで実行中',
  completed: '台帳に実体を確認済み',
  failed: 'キューが失敗として終えた',
  stale: '30 分キューに現れず見失った (失敗とは限らない)',
  missing: '台帳から実体が消えた'
}

/** 状態の内訳表の行頭アクセント。0 件のときは呼び出し側で border-l-border に落とす。 */
export const recordStatusAccent: Record<RecordStatus, string> = {
  none: 'border-l-border',
  pending: 'border-l-primary',
  downloading: 'border-l-info',
  completed: 'border-l-success',
  failed: 'border-l-destructive',
  stale: 'border-l-warning',
  missing: 'border-l-warning'
}
