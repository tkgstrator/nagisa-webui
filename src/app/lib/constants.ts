import { getIntlayer } from 'intlayer'
import { appLocale } from '@/app/lib/locale'
import type { RecordStatus } from '@/schemas/recording.dto'

const content = getIntlayer('constants', appLocale)

export const providerLabel: Record<string, string> = {
  amazon: content.provider.amazon,
  hulu: content.provider.hulu,
  crunchyroll: content.provider.crunchyroll,
  abema: content.provider.abema,
  netflix: content.provider.netflix
}

export const providerColor: Record<string, string> = {
  amazon: 'bg-brand-amazon text-brand-amazon-foreground',
  hulu: 'bg-brand-hulu text-brand-hulu-foreground',
  crunchyroll: 'bg-brand-crunchyroll text-brand-crunchyroll-foreground',
  abema: 'bg-brand-abema text-brand-abema-foreground',
  netflix: 'bg-brand-netflix text-brand-netflix-foreground'
}

/** 画像の上に載せる用。providerColor は半透明で背景が透けるので不透明版を使う。 */
export const providerSolidColor: Record<string, string> = {
  amazon: 'bg-brand-amazon-solid text-brand-amazon-solid-foreground',
  hulu: 'bg-brand-hulu-solid text-brand-hulu-solid-foreground',
  crunchyroll: 'bg-brand-crunchyroll-solid text-brand-crunchyroll-solid-foreground',
  abema: 'bg-brand-abema-solid text-brand-abema-solid-foreground',
  netflix: 'bg-brand-netflix-solid text-brand-netflix-solid-foreground'
}

export const statusLabel: Record<string, string> = {
  FINISHED: content.status.FINISHED,
  RELEASING: content.status.RELEASING,
  NOT_YET_RELEASED: content.status.NOT_YET_RELEASED,
  CANCELLED: content.status.CANCELLED,
  HIATUS: content.status.HIATUS
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
  none: content.recordStatusLabel.none,
  pending: content.recordStatusLabel.pending,
  downloading: content.recordStatusLabel.downloading,
  completed: content.recordStatusLabel.completed,
  failed: content.recordStatusLabel.failed,
  stale: content.recordStatusLabel.stale,
  missing: content.recordStatusLabel.missing
}

/** 各状態が「誰がどう書いたものか」。状態が増えたときの意味を画面に残しておく。 */
export const recordStatusNote: Record<RecordStatus, string> = {
  none: content.recordStatusNote.none,
  pending: content.recordStatusNote.pending,
  downloading: content.recordStatusNote.downloading,
  completed: content.recordStatusNote.completed,
  failed: content.recordStatusNote.failed,
  stale: content.recordStatusNote.stale,
  missing: content.recordStatusNote.missing
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
