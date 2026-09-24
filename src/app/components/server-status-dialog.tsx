import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useAtomValue } from 'jotai'
import { ArrowRight, Loader2, WifiOff } from 'lucide-react'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'
import type { NagisaStatusSchema as NagisaStatus, NagisaStatusJob } from '@/schemas/nagisa.dto'
import type { RecordingSyncState } from '@/schemas/recording.dto'
import { nagisaStatusAtom } from '../lib/atoms'
import { providerColor, providerLabel } from '../lib/constants'
import { recordingSyncStateQueryOptions } from '../lib/query-options'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog'

/**
 * これより古い nagisa は AniList 対応の API (`/api/library/anilist/{id}`) を持たない。
 * バージョンのピルを警告色にして、機能が欠けていることを示す。
 */
const MIN_NAGISA_VERSION = '1.7.0'

/** ジョブ追従は毎分走る。数分の遅れは許し、それを超えたら止まっていると見なす。 */
const JOB_SYNC_WARN_MS = 3 * 60_000
const JOB_SYNC_STALE_MS = 10 * 60_000
/** 台帳同期は変更が無いと 1 時間に 1 回しか時刻を書かない (HEARTBEAT_MS + cron 間隔)。 */
const LIBRARY_SYNC_WARN_MS = 75 * 60_000
const LIBRARY_SYNC_STALE_MS = 3 * 60 * 60_000

/** 失敗したジョブはこの件数までしか並べない。全件はログ画面で見る。 */
const MAX_FAILED_JOBS = 5

const isOlderThan = (version: string, min: string): boolean => {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < b.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (Number.isNaN(x)) return false
    if (x !== y) return x < y
  }
  return false
}

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** 経過時間。「42 秒」「6 分」「1h 38m」「2d 3h」。 */
const formatSpan = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

const formatStamp = (value: number | string): string => dayjs(value).format('MM/DD HH:mm')

/** 相対時刻を進めるための時計。ダイアログが開いている間だけ動く。 */
const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const formatSeasons = (seasons: NagisaStatusJob['seasons']): string | null => {
  if (!seasons || seasons.length === 0) return null
  if (seasons.length > 1) return seasons.map((s) => `S${s.season_number}`).join(', ')
  const [s] = seasons
  if (s.episodes?.length === 1) return `S${s.season_number} · 第 ${s.episodes[0]} 話`
  if (s.episodes && s.episodes.length > 1) return `S${s.season_number} · ${s.episodes.length} 話`
  return `S${s.season_number}`
}

type Tone = 'ok' | 'busy' | 'bad' | 'idle'

const idAccent: Record<Tone, string> = {
  ok: 'border-l-success',
  busy: 'border-l-info',
  bad: 'border-l-destructive',
  idle: 'border-l-muted-foreground'
}

const stateColor: Record<Tone, string> = {
  ok: 'text-success',
  busy: 'text-info',
  bad: 'text-destructive',
  idle: 'text-muted-foreground'
}

const Heading = ({ title, note }: { title: string; note?: string }) => (
  <div className='mt-5 flex items-center justify-between gap-2.5 border-b border-border pb-1.5 text-[10.5px] font-bold tracking-[0.1em] text-muted-foreground uppercase'>
    {title}
    {note && <span className='text-[11.5px] font-medium tracking-normal normal-case tabular-nums'>{note}</span>}
  </div>
)

const QueueCell = ({ label, value, tone }: { label: string; value: number; tone?: 'busy' | 'bad' }) => {
  const color =
    value === 0
      ? 'font-semibold text-muted-foreground'
      : tone === 'busy'
        ? 'text-info'
        : tone === 'bad'
          ? 'text-destructive'
          : ''
  return (
    <div className='min-w-0 flex-1 border-l border-border px-2.5 first:border-l-0 first:pl-0 max-sm:px-1.5'>
      <div className={`text-xl leading-[1.2] font-bold tracking-[-0.02em] tabular-nums max-sm:text-[17px] ${color}`}>
        {value}
      </div>
      <div className='mt-0.5 text-[10.5px] text-muted-foreground'>{label}</div>
    </div>
  )
}

const ProviderTag = ({ provider }: { provider: string }) => (
  <span
    className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.02em] ${providerColor[provider] ?? 'bg-muted text-muted-foreground'}`}
  >
    {providerLabel[provider] ?? provider}
  </span>
)

const JobRow = ({ job, children }: { job: NagisaStatusJob; children: ReactNode }) => (
  <div className='border-b border-border py-[11px] last:border-b-0 last:pb-0.5'>
    <div className='flex items-center gap-[9px]'>
      <span className='min-w-0 flex-1 truncate text-[13px] font-semibold'>{job.title ?? job.content_id}</span>
      <ProviderTag provider={job.provider} />
    </div>
    {children}
  </div>
)

const JobMeta = ({ left, right }: { left: string | null; right: string }) => (
  <div className='mt-[5px] flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums'>
    {left && <span>{left}</span>}
    <span className='ml-auto'>{right}</span>
  </div>
)

const ActiveJob = ({ job }: { job: NagisaStatusJob }) => {
  const started = job.processedOn ?? job.timestamp
  return (
    <JobRow job={job}>
      <JobMeta left={formatSeasons(job.seasons)} right={`${formatStamp(started)} 開始`} />
      <div className='mt-2 flex items-center gap-2.5'>
        <span className='h-1 flex-1 overflow-hidden rounded-full bg-muted'>
          {job.progress && job.progress.total > 0 && (
            <span
              className='block h-full rounded-full bg-info transition-[width]'
              style={{ width: `${Math.min(100, (job.progress.current / job.progress.total) * 100)}%` }}
            />
          )}
        </span>
        <span className='shrink-0 text-[11px] text-muted-foreground tabular-nums'>
          {job.progress ? `${job.progress.current} / ${job.progress.total}` : '進捗待ち'}
        </span>
      </div>
    </JobRow>
  )
}

const FailedJob = ({ job }: { job: NagisaStatusJob }) => {
  const reason = job.failedReason?.split('\n')[0]?.trim()
  return (
    <JobRow job={job}>
      <JobMeta
        left={formatSeasons(job.seasons)}
        right={job.finishedOn ? `${formatStamp(job.finishedOn)} 終了` : `${formatStamp(job.timestamp)} 投入`}
      />
      {reason && (
        <div className='mt-[7px] truncate border-l-2 border-l-destructive py-0.5 pl-[9px] font-mono text-[11px] leading-[1.6] text-destructive'>
          {reason}
        </div>
      )}
    </JobRow>
  )
}

type KvTone = 'ok' | 'warn' | 'bad' | 'mute' | 'plain'

const kvValue: Record<KvTone, string> = {
  ok: 'text-xs font-semibold text-success',
  warn: 'text-xs font-bold text-status-not-yet-foreground',
  bad: 'text-xs font-bold text-destructive',
  mute: 'font-mono text-[11.5px] text-muted-foreground',
  plain: 'font-mono text-[11.5px]'
}

const KvRow = ({ label, value, tone = 'plain' }: { label: string; value: string; tone?: KvTone }) => (
  <div className='flex items-center gap-3.5 border-b border-border py-[7px] text-xs last:border-b-0'>
    <span className='w-[108px] shrink-0 text-muted-foreground max-sm:w-[92px]'>{label}</span>
    <span className={`ml-auto tabular-nums ${kvValue[tone]}`}>{value}</span>
  </div>
)

/** 最後に動いた時刻の鮮度。止まっていれば経過時間を「停止」として出す。 */
const freshness = (
  at: string | null,
  now: number,
  warnMs: number,
  staleMs: number
): { value: string; tone: KvTone } => {
  if (!at) return { value: '未実行', tone: 'mute' }
  const age = now - dayjs(at).valueOf()
  if (age >= staleMs) return { value: `${formatSpan(age)} 停止`, tone: 'bad' }
  return { value: `${formatSpan(age)}前`, tone: age >= warnMs ? 'warn' : 'ok' }
}

const JobSyncRow = ({ sync, now }: { sync: RecordingSyncState; now: number }) => {
  // 追跡対象が無い間は cron が SyncRun を残さないので、時刻が古いのは正常。
  if (sync.tracked === 0) return <KvRow label='ジョブ同期' value='追跡対象なし' tone='mute' />
  const f = freshness(sync.lastJobSyncAt, now, JOB_SYNC_WARN_MS, JOB_SYNC_STALE_MS)
  return <KvRow label='ジョブ同期' value={f.value} tone={f.tone} />
}

const SyncSection = ({ sync, now }: { sync: RecordingSyncState | undefined; now: number }) => {
  if (!sync) return null
  const library = freshness(sync.lastSucceededAt, now, LIBRARY_SYNC_WARN_MS, LIBRARY_SYNC_STALE_MS)
  const bootstrapping = sync.snapshotStartedAt !== null || sync.snapshotCursor !== null
  return (
    <>
      <Heading title='録画同期' note='Workers 側 cron' />
      <div className='mt-2.5'>
        <JobSyncRow sync={sync} now={now} />
        <KvRow label='ライブラリ同期' value={library.value} tone={library.tone} />
        {sync.tracked > 0 && <KvRow label='反映待ち' value={`${sync.tracked} 件 (録画中)`} tone='mute' />}
        {bootstrapping && (
          <>
            <KvRow label='取り込み' value='全件を取り込み中' tone='warn' />
            {sync.snapshotStartedAt && <KvRow label='開始' value={formatStamp(sync.snapshotStartedAt)} />}
          </>
        )}
      </div>
      {bootstrapping && (
        <p className='mt-3 text-xs text-muted-foreground'>
          サーバー交換後の初回のみ全件を取り込みます。完了するまで一部の録画が「未確認」のままになります。
        </p>
      )}
    </>
  )
}

/** 詳細ページへの導線。状態によらず最下段の同じ位置に置く。 */
const DetailLink = () => (
  <DialogClose
    render={
      <Link
        to='/admin/status'
        className='group mt-[18px] flex items-center gap-2.5 border-t border-border pt-[13px] text-[12.5px] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
      />
    }
  >
    <span className='shrink-0 font-semibold'>詳細とリソース</span>
    <span className='min-w-0 truncate text-[11.5px] text-muted-foreground max-sm:hidden'>
      Redis · CPU · 台帳 · 同期ロック
    </span>
    <ArrowRight className='ml-auto size-[15px] shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-foreground' />
  </DialogClose>
)

const Message = ({ icon, title, detail, bad }: { icon: ReactNode; title: string; detail: string; bad?: boolean }) => (
  <div
    className={`flex items-center gap-3 pt-1 pb-0.5 ${bad ? '[&>svg]:text-destructive' : '[&>svg]:text-muted-foreground'}`}
  >
    {icon}
    <div>
      <DialogTitle className='text-[13px] font-semibold'>{title}</DialogTitle>
      <p className='mt-[3px] text-[11.5px] text-muted-foreground'>{detail}</p>
    </div>
  </div>
)

const OnlineBody = ({
  status,
  sync,
  now,
  respondedAt
}: {
  status: NagisaStatus
  sync: RecordingSyncState | undefined
  now: number
  respondedAt: number
}) => {
  const queue = status.queue
  const active = queue?.active.jobs ?? []
  const failed = queue?.failed.jobs ?? []
  const failedCount = queue?.failed.count ?? 0
  const activeCount = queue?.active.count ?? 0
  const bootstrapping = sync ? sync.snapshotStartedAt !== null || sync.snapshotCursor !== null : false

  const lastFailedAt = failed.reduce<number | null>((acc, j) => {
    const t = j.finishedOn ?? j.timestamp
    return acc === null || t > acc ? t : acc
  }, null)

  const uptime = `稼働 ${formatUptime(status.uptime)}`
  const [tone, label, sub]: [Tone, string, string] =
    failedCount > 0
      ? [
          'bad',
          `${failedCount} ${failedCount === 1 ? 'JOB' : 'JOBS'} FAILED`,
          lastFailedAt ? `${uptime} · 直近の失敗 ${formatSpan(now - lastFailedAt)}前` : uptime
        ]
      : activeCount > 0
        ? ['busy', 'DOWNLOADING', `${uptime} · ${activeCount} 件を処理中`]
        : bootstrapping
          ? ['idle', 'SYNCING', `${uptime} · 台帳を取り込み中`]
          : ['ok', 'ONLINE', `${uptime} · 最終応答 ${formatSpan(now - respondedAt)}前`]
  const live = tone === 'busy' || tone === 'idle'

  return (
    <>
      <div className='flex items-start justify-between gap-4 pr-7'>
        <div className={`border-l-3 pl-3 ${idAccent[tone]}`}>
          <DialogTitle className='text-[17px] font-bold tracking-[-0.02em]'>Nagisa</DialogTitle>
          <div
            className={`mt-[5px] flex items-center gap-[7px] text-[11px] font-bold tracking-[0.08em] ${stateColor[tone]}`}
          >
            <span
              aria-hidden='true'
              className={`size-1.5 shrink-0 rounded-full bg-current ${live ? 'animate-pulse' : ''}`}
            />
            {label}
          </div>
          <p className='mt-1.5 text-xs text-muted-foreground tabular-nums'>{sub}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-[9px] py-[3px] font-mono text-[11.5px] font-semibold ${isOlderThan(status.version, MIN_NAGISA_VERSION) ? 'bg-status-not-yet text-status-not-yet-foreground' : 'bg-muted text-muted-foreground'}`}
          title={isOlderThan(status.version, MIN_NAGISA_VERSION) ? `v${MIN_NAGISA_VERSION} 以上を推奨` : undefined}
        >
          v{status.version}
        </span>
      </div>

      <Heading title='キュー' note='nagisa の保持分' />
      {queue ? (
        <>
          <div className='mt-3 flex'>
            <QueueCell label='待機' value={queue.wait.count} />
            <QueueCell label='実行中' value={queue.active.count} tone='busy' />
            <QueueCell label='完了' value={queue.completed.count} />
            <QueueCell label='失敗' value={queue.failed.count} tone='bad' />
            <QueueCell label='遅延' value={queue.delayed.count} />
          </div>
          {activeCount === 0 && failedCount === 0 && (
            <p className='mt-3 text-xs text-muted-foreground'>実行中のジョブはありません。</p>
          )}
        </>
      ) : (
        <p className='mt-3 text-xs text-muted-foreground'>キューの状態を取得できません (Redis 未接続)。</p>
      )}

      {active.length > 0 && (
        <>
          <Heading title='実行中のジョブ' note={`${activeCount} 件`} />
          <div>
            {active.map((job) => (
              <ActiveJob key={job.job_id} job={job} />
            ))}
          </div>
        </>
      )}

      {failed.length > 0 && (
        <>
          <Heading
            title='失敗したジョブ'
            note={failedCount > MAX_FAILED_JOBS ? `${failedCount} 件中 ${MAX_FAILED_JOBS} 件` : `${failedCount} 件`}
          />
          <div>
            {failed.slice(0, MAX_FAILED_JOBS).map((job) => (
              <FailedJob key={job.job_id} job={job} />
            ))}
          </div>
        </>
      )}

      <SyncSection sync={sync} now={now} />
    </>
  )
}

const OfflineBody = ({
  sync,
  now,
  respondedAt
}: {
  sync: RecordingSyncState | undefined
  now: number
  respondedAt: number
}) => (
  <>
    <Message
      bad
      icon={<WifiOff className='size-5 shrink-0' />}
      title='オフライン'
      detail='録画サーバーに接続できません'
    />
    <div className='mt-2.5'>
      <KvRow
        label='最終応答'
        value={respondedAt > 0 ? formatStamp(respondedAt) : '未接続'}
        tone={respondedAt > 0 ? 'plain' : 'mute'}
      />
      {sync && <JobSyncRow sync={sync} now={now} />}
    </div>
  </>
)

const StatusBody = () => {
  const { data: status, isPending, isError, dataUpdatedAt } = useAtomValue(nagisaStatusAtom)
  // 台帳・ジョブ同期の状態は D1 だけで返るので、nagisa が落ちていても取れる。
  const { data: sync } = useQuery(recordingSyncStateQueryOptions())
  const now = useNow(5_000)

  return (
    <>
      {isPending ? (
        <>
          <Message
            icon={<Loader2 className='size-5 shrink-0 animate-spin' />}
            title='接続しています'
            detail='録画サーバーの状態を取得中'
          />
          <div className='mt-3.5 flex flex-col gap-2' aria-hidden='true'>
            <i className='block h-2.5 rounded bg-muted' />
            <i className='block h-2.5 w-[72%] rounded bg-muted' />
            <i className='block h-2.5 w-[48%] rounded bg-muted' />
          </div>
        </>
      ) : isError || !status ? (
        <OfflineBody sync={sync} now={now} respondedAt={dataUpdatedAt} />
      ) : (
        <OnlineBody status={status} sync={sync} now={now} respondedAt={dataUpdatedAt} />
      )}
      <DetailLink />
    </>
  )
}

/** 開くための要素は呼び出し側が渡す。サイドバー最下段のステータス行がそれを兼ねる。 */
export const ServerStatusDialog = ({ trigger }: { trigger: ReactElement }) => (
  <Dialog>
    <DialogTrigger render={trigger} />
    <DialogContent className='block max-h-[85vh] overflow-y-auto px-[22px] pt-[22px] pb-5 select-none sm:max-w-lg max-sm:px-4 max-sm:pt-[18px] max-sm:pb-4'>
      <StatusBody />
    </DialogContent>
  </Dialog>
)
