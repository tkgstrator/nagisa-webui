import type { SyncRunSchema } from '@/schemas/log.dto'

export const runStatusLabel: Record<SyncRunSchema['status'], string> = {
  running: '実行中',
  success: '成功',
  partial: '一部失敗',
  failed: '失敗'
}

/** 行頭のアクセント。失敗 → destructive、一部失敗 → warning、成功 → success、実行中 → primary。 */
export const runStatusAccent: Record<SyncRunSchema['status'], string> = {
  running: 'border-l-primary',
  success: 'border-l-success',
  partial: 'border-l-warning',
  failed: 'border-l-destructive'
}

export const runStatusBadge: Record<SyncRunSchema['status'], string> = {
  running: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success dark:text-foreground',
  partial: 'bg-warning/20 text-warning-foreground',
  failed: 'bg-destructive/10 text-destructive'
}

export const runKindLabel: Record<SyncRunSchema['kind'], string> = {
  cron: 'Schedule',
  queue: 'Queue',
  manual: 'Manual'
}

/**
 * cron 式を人が読める名前にする。`src/routes/admin-logs.ts` の CRON_DEFINITIONS と
 * 同じ内容だが、/runs は式しか返さないのでこちらにも持つ。
 */
const cronLabels: Record<string, string> = {
  // 録画同期の 2 本は cron 式ではなく仕事の名前で記録される (→ `scheduled.ts`)。
  'job-sync': '録画ジョブ追従',
  'library-sync': '録画台帳の差分',
  '0 */1 * * *': '新着 / 配信予定',
  '0 0 * * *': '配信終了間近',
  '0 3 * * *': 'カタログ全件',
  '0 4 * * *': 'ABEMA 鍵アーカイブ',
  '0 5 * * SUN': 'AniList 同期'
}

/** cron 以外の trigger (`batch` など) はそのまま返す。 */
export const triggerLabel = (run: SyncRunSchema): string =>
  run.kind === 'cron' ? (cronLabels[run.trigger] ?? run.trigger) : run.trigger

/** 「1.4 秒」「2 分 05 秒」。まだ終わっていなければ null。 */
export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} 秒`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`
}
