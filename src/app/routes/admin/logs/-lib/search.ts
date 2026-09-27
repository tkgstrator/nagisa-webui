import type { QueryClient } from '@tanstack/react-query'
import { getIntlayer } from 'intlayer'
import { z } from 'zod'
import { appLocale } from '@/app/lib/locale'
import { logEntriesQueryOptions, recordingEventsQueryOptions, syncRunsQueryOptions } from '@/app/lib/query-options'
import { readSettings } from '@/app/routes/settings/-lib/settings'
import {
  LogLevelEnum,
  RecordingEventKindEnum,
  RecordingEventStatusEnum,
  RunKindEnum,
  RunStatusEnum
} from '@/schemas/log.dto'
import { logLevelLabel, recordingKindLabel, recordingStatusLabel, runKindLabel, runStatusLabel } from './format'

const moduleContent = getIntlayer('admin-logs', appLocale)

export const TabEnum = z.enum(['runs', 'entries', 'recordings'])
export type Tab = z.infer<typeof TabEnum>

export const SearchSchema = z.object({
  tab: TabEnum.default('runs'),
  kind: RunKindEnum.optional(),
  status: RunStatusEnum.optional(),
  // 期間は 3 タブで共有する。保持期間が一番長い録画 (180 日) に合わせて上限を取り、
  // 実行履歴と生ログには投げる直前に各テーブルの保持期間で頭打ちを掛ける。
  hours: z.coerce.number().int().min(1).max(4320).default(24),
  level: LogLevelEnum.default('info'),
  // 録画の絞り込みは実行履歴の kind / status と意味が違うので別のキーで持つ。
  recKind: RecordingEventKindEnum.optional(),
  recStatus: RecordingEventStatusEnum.optional(),
  q: z.string().nonempty().optional()
})

export type Search = z.infer<typeof SearchSchema>

/** 各タブが URL の検索条件を書き換えるときの窓口。ページ番号は呼ぶ側で 1 に戻す。 */
export type UpdateSearch = (patch: Partial<Search>) => void

type Option<T> = { value: T; label: string }

export const KIND_OPTIONS: Option<Search['kind']>[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'cron', label: runKindLabel.cron },
  { value: 'queue', label: runKindLabel.queue },
  { value: 'manual', label: runKindLabel.manual }
]

export const STATUS_OPTIONS: Option<Search['status']>[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'failed', label: runStatusLabel.failed },
  { value: 'partial', label: runStatusLabel.partial },
  { value: 'success', label: runStatusLabel.success },
  { value: 'running', label: runStatusLabel.running }
]

/** 指定した重大度「以上」が返る。debug は D1 に入らないので出さない。 */
export const LEVEL_OPTIONS: Option<Search['level']>[] = [
  { value: 'info', label: moduleContent.options.level.infoAndAbove({ label: logLevelLabel.info }) },
  { value: 'warning', label: moduleContent.options.level.andAbove({ label: logLevelLabel.warning }) },
  { value: 'error', label: moduleContent.options.level.onlyLabel({ label: logLevelLabel.error }) },
  { value: 'fatal', label: moduleContent.options.level.onlyLabel({ label: logLevelLabel.fatal }) }
]

export const REC_KIND_OPTIONS: Option<Search['recKind']>[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'request', label: recordingKindLabel.request },
  { value: 'status', label: recordingKindLabel.status },
  { value: 'recorded', label: recordingKindLabel.recorded },
  { value: 'not-found', label: recordingKindLabel['not-found'] }
]

export const REC_STATUS_OPTIONS: Option<Search['recStatus']>[] = [
  { value: undefined, label: moduleContent.common.all },
  { value: 'error', label: recordingStatusLabel.error },
  { value: 'ok', label: recordingStatusLabel.ok }
]

const hours = moduleContent.options.hours

export const HOURS_OPTIONS: Record<Tab, Option<number>[]> = {
  runs: [
    { value: 24, label: hours.h24 },
    { value: 72, label: hours.h72 },
    { value: 168, label: hours.h168 },
    { value: 720, label: hours.h720 },
    { value: 2160, label: hours.h2160 }
  ],
  entries: [
    { value: 24, label: hours.h24 },
    { value: 72, label: hours.h72 },
    { value: 168, label: hours.h168 },
    { value: 336, label: hours.h336 }
  ],
  recordings: [
    { value: 24, label: hours.h24 },
    { value: 168, label: hours.h168 },
    { value: 720, label: hours.h720 },
    { value: 2160, label: hours.h2160 },
    { value: 4320, label: hours.h4320 }
  ]
}

/** log_entries は 14 日しか持たないので、実行履歴側の広い期間をそのまま投げない。 */
export const ENTRY_MAX_HOURS = 336

/** sync_runs の保持期間は 90 日。録画タブから戻ってきた 180 日をそのまま投げない。 */
export const RUN_MAX_HOURS = 2160

/** 開いているタブのぶんだけ先に取る。3 本とも取ると表示しない 2 本まで待つことになる。 */
export const ensureTabData = (queryClient: QueryClient, deps: Search) => {
  const limit = readSettings().pageSize
  if (deps.tab === 'entries')
    return queryClient.ensureInfiniteQueryData(
      logEntriesQueryOptions({ limit, level: deps.level, hours: Math.min(deps.hours, ENTRY_MAX_HOURS), q: deps.q })
    )
  if (deps.tab === 'recordings')
    return queryClient.ensureQueryData(
      recordingEventsQueryOptions({
        page: 1,
        limit,
        kind: deps.recKind,
        status: deps.recStatus,
        hours: deps.hours
      })
    )
  return queryClient.ensureQueryData(
    syncRunsQueryOptions({
      page: 1,
      limit,
      kind: deps.kind,
      status: deps.status,
      hours: Math.min(deps.hours, RUN_MAX_HOURS)
    })
  )
}
