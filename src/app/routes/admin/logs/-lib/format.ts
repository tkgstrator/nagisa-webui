import dayjs from 'dayjs'
import { getIntlayer } from 'intlayer'
import type { CatalogEventSchema, LogLevelEnum, RecordingEventSchema, SyncRunSchema } from '@/schemas/log.dto'

const content = getIntlayer('admin-logs-format')

export const runStatusLabel: Record<SyncRunSchema['status'], string> = {
  running: content.runStatusLabel.running,
  success: content.runStatusLabel.success,
  partial: content.runStatusLabel.partial,
  failed: content.runStatusLabel.failed
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
  cron: content.runKindLabel.cron,
  queue: content.runKindLabel.queue,
  manual: content.runKindLabel.manual
}

export const logLevelLabel: Record<LogLevelEnum, string> = {
  debug: content.logLevelLabel.debug,
  info: content.logLevelLabel.info,
  warning: content.logLevelLabel.warning,
  error: content.logLevelLabel.error,
  fatal: content.logLevelLabel.fatal
}

/** 行頭のアクセント。info / debug は平常運転なので色を付けない。 */
export const logLevelAccent: Record<LogLevelEnum, string> = {
  debug: 'border-l-transparent',
  info: 'border-l-transparent',
  warning: 'border-l-warning',
  error: 'border-l-destructive',
  fatal: 'border-l-destructive'
}

export const logLevelBadge: Record<LogLevelEnum, string> = {
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-muted text-muted-foreground',
  warning: 'bg-warning/20 text-warning-foreground',
  error: 'bg-destructive/10 text-destructive',
  fatal: 'bg-destructive text-destructive-foreground'
}

export const recordingKindLabel: Record<RecordingEventSchema['kind'], string> = {
  request: content.recordingKindLabel.request,
  status: content.recordingKindLabel.status,
  recorded: content.recordingKindLabel.recorded,
  'not-found': content.recordingKindLabel.notFound
}

export const recordingSourceLabel: Record<RecordingEventSchema['source'], string> = {
  cron: content.recordingSourceLabel.cron,
  manual: content.recordingSourceLabel.manual
}

export const recordingStatusLabel: Record<RecordingEventSchema['status'], string> = {
  ok: content.recordingStatusLabel.ok,
  error: content.recordingStatusLabel.error
}

/**
 * 行頭のアクセント。うまくいった行には色を付けない (色が付いている = 見るべき行)。
 * 「見つからない」は上流に無いだけでこちらの障害ではないので warning 止まり。
 */
export const recordingAccent = (event: RecordingEventSchema): string => {
  if (event.status === 'ok') return 'border-l-transparent'
  return event.kind === 'not-found' ? 'border-l-warning' : 'border-l-destructive'
}

export const recordingStatusBadge: Record<RecordingEventSchema['status'], string> = {
  ok: 'bg-success/15 text-success dark:text-foreground',
  error: 'bg-destructive/10 text-destructive'
}

export const catalogKindLabel: Record<CatalogEventSchema['kind'], string> = {
  'title-added': content.catalogKindLabel.titleAdded,
  'season-added': content.catalogKindLabel.seasonAdded,
  'episodes-added': content.catalogKindLabel.episodesAdded,
  'episodes-updated': content.catalogKindLabel.episodesUpdated
}

export const catalogFieldLabel: Record<NonNullable<CatalogEventSchema['fields']>[number], string> = {
  image: content.catalogFieldLabel.image,
  description: content.catalogFieldLabel.description,
  duration: content.catalogFieldLabel.duration,
  releaseDate: content.catalogFieldLabel.releaseDate
}

/** 行頭のアクセント。作品単位で増えたもの (タイトル / シーズン) だけ色を付け、話単位の出入りは素のまま。 */
export const catalogAccent: Record<CatalogEventSchema['kind'], string> = {
  'title-added': 'border-l-success',
  'season-added': 'border-l-info',
  'episodes-added': 'border-l-transparent',
  'episodes-updated': 'border-l-transparent'
}

/** 「12:04:31」。録画は秒の並びが意味を持つので秒まで出す。 */
export const formatClock = (value: string): string => {
  const target = dayjs(value)
  return target.isValid() ? target.format('HH:mm:ss') : '—'
}

/** 「今日」「昨日」「9/14」。時刻の下に置く日付。 */
export const formatDay = (value: string): string => {
  const target = dayjs(value)
  if (!target.isValid()) return '—'
  const days = dayjs().startOf('day').diff(target.startOf('day'), 'day')
  if (days === 0) return content.day.today
  if (days === 1) return content.day.yesterday
  return target.format('M/D')
}

/**
 * cron 式を人が読める名前にする。`src/routes/admin-logs.ts` の CRON_DEFINITIONS と
 * 同じ内容だが、/runs は式しか返さないのでこちらにも持つ。
 */
const cronLabels: Record<string, string> = {
  // 録画同期の 2 本は cron 式ではなく仕事の名前で記録される (→ `scheduled.ts`)。
  'job-sync': content.cronLabels.jobSync,
  'library-sync': content.cronLabels.librarySync,
  '0 */1 * * *': content.cronLabels.hourly,
  '0 0 * * *': content.cronLabels.endingSoon,
  '0 3 * * *': content.cronLabels.catalogFull,
  '0 4 * * *': content.cronLabels.abemaKeyArchive,
  '0 5 * * SUN': content.cronLabels.aniListSync
}

/** cron 以外の trigger (`batch` など) はそのまま返す。 */
export const triggerLabel = (run: SyncRunSchema): string =>
  run.kind === 'cron' ? (cronLabels[run.trigger] ?? run.trigger) : run.trigger

/** 「1.4 秒」「2 分 05 秒」。まだ終わっていなければ null。 */
export const formatDuration = (ms: number | null): string => {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return content.duration.seconds({ value: (ms / 1000).toFixed(1) })
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return content.duration.minutesSeconds({ minutes, seconds: String(seconds).padStart(2, '0') })
}
