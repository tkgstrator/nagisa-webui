import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useIntlayer } from 'react-intlayer'
import { PageContainer } from '@/app/components/page-container'
import { StatTile } from '@/app/components/stat-tile'
import { recordStatusAccent, recordStatusLabel, recordStatusNote } from '@/app/lib/constants'
import {
  recorderQueueSnapshotQueryOptions,
  recorderStatusQueryOptions,
  recordingLibraryStatsQueryOptions,
  recordingSyncStateQueryOptions
} from '@/app/lib/query-options'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import { RecordStatusEnum } from '@/schemas/recording.dto'

export const Route = createFileRoute('/admin/status/')({
  component: StatusAdminPage
})

const headClass =
  'px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.03em] text-muted-foreground max-sm:px-[5px] max-sm:py-[9px]'
const cellClass = 'p-2.5 align-middle max-sm:px-[5px] max-sm:py-[9px]'

/** 台帳の合計サイズ。TB を超えたら TB 表記にする。 */
const formatSize = (bytes: number): string => {
  const gb = bytes / 1024 ** 3
  return gb >= 1024 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`
}

type FieldTone = 'mute' | 'ok' | 'warn' | 'err'

const fieldAccent: Record<FieldTone, string> = {
  mute: 'border-l-border',
  ok: 'border-l-success',
  warn: 'border-l-warning',
  err: 'border-l-destructive'
}

/** 数値にならない項目 (バージョン・カーソル・ロック) 用。StatTile と縦の見えを揃える。 */
const Field = ({
  label,
  value,
  note,
  tone = 'mute',
  mono
}: {
  label: string
  value: string
  note?: string
  tone?: FieldTone
  mono?: boolean
}) => (
  <div className={`flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5 ${fieldAccent[tone]}`}>
    <span className='text-xs leading-[1.5] text-muted-foreground'>{label}</span>
    <span className={`truncate text-[15px] font-semibold leading-[1.4] ${mono ? 'font-mono text-[13px]' : ''}`}>
      {value}
    </span>
    <span className='text-xs leading-[1.5] text-muted-foreground'>{note ?? ''}</span>
  </div>
)

const Notice = ({ tone, children }: { tone: FieldTone; children: ReactNode }) => (
  <p className={`rounded-r-lg border-l-[3px] py-2 pr-2 pl-3.5 text-sm text-muted-foreground ${fieldAccent[tone]}`}>
    {children}
  </p>
)

const Section = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <section className='flex flex-col gap-3'>
    <div>
      <h2 className='text-sm font-semibold'>{title}</h2>
      <p className='mt-0.5 text-xs text-muted-foreground'>{description}</p>
    </div>
    {children}
  </section>
)

const tileGrid = 'grid grid-cols-4 gap-6 max-lg:grid-cols-2'

function StatusAdminPage() {
  const content = useIntlayer('admin-status')

  // 上流 (nagisa) を叩く 3 本は落ちていることが正常系なので、失敗を画面に出すだけで
  // ページ全体は落とさない。sync-state はローカル D1 だけなので必ず返る。
  const status = useQuery(recorderStatusQueryOptions())
  const snapshot = useQuery(recorderQueueSnapshotQueryOptions())
  const stats = useQuery(recordingLibraryStatsQueryOptions())
  const sync = useQuery(recordingSyncStateQueryOptions())

  // ロックは期限を見ないと意味が反転する。同期が異常終了すると lease_until だけが
  // 残るので、「非 null = 実行中」と読むと止まっているものが走って見える。
  const leaseUntil = sync.data?.leaseUntil ?? null
  const leaseExpired = leaseUntil !== null && new Date(leaseUntil).getTime() <= Date.now()

  /** 秒 → 「3 日 4 時間」。分未満は切り捨てて「1 分未満」に畳む。 */
  const formatUptime = (seconds: number): string => {
    const d = Math.floor(seconds / 86_400)
    const h = Math.floor((seconds % 86_400) / 3_600)
    const m = Math.floor((seconds % 3_600) / 60)
    if (d > 0) return content.uptime.days({ d, h }).value
    if (h > 0) return content.uptime.hours({ h, m }).value
    return m > 0 ? content.uptime.minutes({ m }).value : content.uptime.lessThanMinute.value
  }

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>{content.title.value}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{content.description.value}</p>
      </header>

      <Section title='Nagisa' description={content.nagisaSection.description.value}>
        {status.isPending ? (
          <Notice tone='mute'>{content.loading.value}</Notice>
        ) : status.isError || status.data === undefined ? (
          <Notice tone='err'>{content.nagisaSection.error.value}</Notice>
        ) : (
          <div className={tileGrid}>
            <Field
              label={content.nagisaSection.version.value}
              value={`v${status.data.version}`}
              note={content.nagisaSection.uptimeNote({ uptime: formatUptime(status.data.uptime) }).value}
              tone='ok'
            />
            <Field
              label={content.nagisaSection.redisLabel.value}
              value={
                status.data.redis === null
                  ? content.unknown.value
                  : status.data.redis.connected
                    ? content.nagisaSection.redisConnected.value
                    : content.nagisaSection.redisDisconnected.value
              }
              note={
                status.data.redis === null
                  ? content.nagisaSection.redisUnknownNote.value
                  : content.nagisaSection.redisMemoryNote({ memory: status.data.redis.memory_used }).value
              }
              tone={status.data.redis?.connected === true ? 'ok' : 'err'}
            />
            <Field
              label={content.nagisaSection.cpuMemory.value}
              value={
                status.data.system === null
                  ? content.unknown.value
                  : `${status.data.system.cpu_percent.toFixed(1)}% / ${status.data.system.memory_percent.toFixed(1)}%`
              }
              note={content.nagisaSection.cpuMemoryNote.value}
              tone={(status.data.system?.memory_percent ?? 0) >= 90 ? 'warn' : 'mute'}
            />
            <Field
              label={content.nagisaSection.diskFree.value}
              value={
                status.data.system === null ? content.unknown.value : `${status.data.system.disk_free_gb.toFixed(1)} GB`
              }
              note={content.nagisaSection.diskFreeNote.value}
              tone={(status.data.system?.disk_free_gb ?? Number.POSITIVE_INFINITY) < 100 ? 'warn' : 'mute'}
            />
          </div>
        )}
      </Section>

      <Section title={content.queueSection.title.value} description={content.queueSection.description.value}>
        {snapshot.isPending ? (
          <Notice tone='mute'>{content.loading.value}</Notice>
        ) : snapshot.isError || snapshot.data === undefined ? (
          <Notice tone='err'>{content.queueSection.error.value}</Notice>
        ) : (
          <>
            <div className={tileGrid}>
              <StatTile
                label={content.queueSection.active.value}
                value={snapshot.data.counts.active}
                unit={content.queueSection.unit.value}
                note={content.queueSection.activeNote.value}
                tone='primary'
              />
              <StatTile
                label={content.queueSection.waiting.value}
                value={snapshot.data.counts.wait + snapshot.data.counts.delayed}
                unit={content.queueSection.unit.value}
                note={
                  content.queueSection.waitingNote({ count: snapshot.data.counts.delayed.toLocaleString('ja-JP') })
                    .value
                }
                tone='warn'
              />
              <StatTile
                label={content.queueSection.failed.value}
                value={snapshot.data.counts.failed}
                unit={content.queueSection.unit.value}
                note={content.queueSection.failedNote.value}
                tone='err'
              />
              <StatTile
                label={content.queueSection.completed.value}
                value={snapshot.data.counts.completed}
                unit={content.queueSection.unit.value}
                note={content.queueSection.completedNote.value}
                tone='ok'
              />
            </div>
            <p className='text-xs text-muted-foreground'>
              {content.queueSection.fetchedAt({
                time: formatAbsolute(new Date(snapshot.data.generated_at * 1000).toISOString())
              })}
            </p>
          </>
        )}
      </Section>

      <Section title={content.librarySection.title.value} description={content.librarySection.description.value}>
        {stats.isPending ? (
          <Notice tone='mute'>{content.loading.value}</Notice>
        ) : stats.isError || stats.data === undefined ? (
          <Notice tone='err'>{content.librarySection.error.value}</Notice>
        ) : (
          <div className={tileGrid}>
            <StatTile
              label={content.librarySection.recordings.value}
              value={stats.data.recordings}
              unit={content.librarySection.unit.value}
              note={content.librarySection.recordingsNote.value}
              tone='ok'
            />
            <StatTile
              label={content.librarySection.unresolved.value}
              value={stats.data.unresolved}
              unit={content.librarySection.unit.value}
              note={content.librarySection.unresolvedNote.value}
              tone='warn'
            />
            <Field
              label={content.librarySection.totalSize.value}
              value={formatSize(stats.data.total_size)}
              note={content.librarySection.totalSizeNote.value}
            />
            <Field
              label={content.librarySection.position.value}
              value={`seq ${stats.data.last_seq.toLocaleString('ja-JP')}`}
              note={`epoch ${stats.data.epoch}`}
              mono
            />
          </div>
        )}
      </Section>

      <Section title={content.syncSection.title.value} description={content.syncSection.description.value}>
        {sync.isPending ? (
          <Notice tone='mute'>{content.loading.value}</Notice>
        ) : sync.data === undefined ? (
          <Notice tone='err'>{content.syncSection.error.value}</Notice>
        ) : (
          <>
            {/*
              react-query は再取得に失敗しても直前の data を保持する。黙って出すと
              「同期が止まっている」と「同期状態を読めていない」が見分けられない。
            */}
            {sync.isError && <Notice tone='warn'>{content.syncSection.staleWarning.value}</Notice>}
            <div className={tileGrid}>
              <Field
                label={content.syncSection.lastSucceeded.value}
                value={
                  sync.data.lastSucceededAt === null
                    ? content.syncSection.neverRun.value
                    : formatRelative(sync.data.lastSucceededAt)
                }
                note={
                  sync.data.lastSucceededAt === null
                    ? content.syncSection.neverRunNote.value
                    : formatAbsolute(sync.data.lastSucceededAt)
                }
                tone={sync.data.lastSucceededAt === null ? 'err' : 'ok'}
              />
              <Field
                label={content.syncSection.cursor.value}
                value={
                  sync.data.snapshotCursor !== null
                    ? content.syncSection.cursorSnapshotting.value
                    : sync.data.cursor === null
                      ? content.syncSection.cursorUnfetched.value
                      : content.syncSection.cursorTracking.value
                }
                note={
                  sync.data.snapshotCursor !== null && sync.data.snapshotStartedAt !== null
                    ? content.syncSection.cursorSnapshotStartedNote({
                        time: formatRelative(sync.data.snapshotStartedAt)
                      }).value
                    : sync.data.cursor === null
                      ? content.syncSection.cursorNeverRunNote.value
                      : content.syncSection.cursorTrackingNote.value
                }
                tone={sync.data.cursor === null && sync.data.snapshotCursor === null ? 'warn' : 'mute'}
              />
              <Field
                label={content.syncSection.lock.value}
                value={
                  leaseUntil === null
                    ? content.syncSection.lockFree.value
                    : leaseExpired
                      ? content.syncSection.lockExpired.value
                      : content.syncSection.lockRunning.value
                }
                note={
                  leaseUntil === null
                    ? content.syncSection.lockFreeNote.value
                    : leaseExpired
                      ? content.syncSection.lockExpiredNote({
                          owner: sync.data.leaseOwner ?? content.unknown.value,
                          time: formatRelative(leaseUntil)
                        }).value
                      : content.syncSection.lockRunningNote({
                          owner: sync.data.leaseOwner ?? content.unknown.value,
                          time: formatAbsolute(leaseUntil)
                        }).value
                }
                tone={leaseExpired ? 'warn' : 'mute'}
              />
              <StatTile
                label={content.syncSection.tracked.value}
                value={sync.data.tracked}
                unit={content.syncSection.unit.value}
                note={content.syncSection.trackedNote.value}
                tone='primary'
              />
            </div>
          </>
        )}
      </Section>

      {sync.data !== undefined && (
        <Section
          title={content.breakdownSection.title.value}
          description={
            sync.isError
              ? content.breakdownSection.descriptionError.value
              : content.breakdownSection.descriptionOk.value
          }
        >
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-[13px]'>
              <thead>
                <tr className='border-b border-border'>
                  <th scope='col' className={`${headClass} pl-[13px]`}>
                    {content.breakdownSection.status.value}
                  </th>
                  <th scope='col' className={`${headClass} text-right`}>
                    {content.breakdownSection.count.value}
                  </th>
                  <th scope='col' className={headClass}>
                    {content.breakdownSection.meaning.value}
                  </th>
                </tr>
              </thead>
              <tbody>
                {RecordStatusEnum.options.map((s) => {
                  const count = sync.data.counts[s]
                  return (
                    <tr key={s} className='border-b border-border transition-colors hover:bg-muted'>
                      <td
                        className={`${cellClass} whitespace-nowrap border-l-[3px] font-medium ${count === 0 ? 'border-l-border text-muted-foreground' : recordStatusAccent[s]}`}
                      >
                        {recordStatusLabel[s]}
                      </td>
                      <td
                        className={`${cellClass} text-right tabular-nums ${count === 0 ? 'text-muted-foreground' : ''}`}
                      >
                        {count.toLocaleString('ja-JP')}
                      </td>
                      <td className={`${cellClass} text-muted-foreground`}>{recordStatusNote[s]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </PageContainer>
  )
}
