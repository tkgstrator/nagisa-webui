import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'
import { DataTable, DataTd, DataTh, DataTr, type RowTone } from '@/app/components/data-table'
import { FormHint } from '@/app/components/form-field'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { PageNotice, PageSection } from '@/app/components/page-section'
import { StatGrid, StatTile } from '@/app/components/stat-tile'
import { recordStatusLabel, recordStatusNote } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import {
  recorderQueueSnapshotQueryOptions,
  recorderStatusQueryOptions,
  recordingLibraryStatsQueryOptions,
  recordingSyncStateQueryOptions
} from '@/app/lib/query-options'
import { formatAbsolute, formatRelative } from '@/app/routes/recordings/-components/format'
import { type RecordStatus, RecordStatusEnum } from '@/schemas/recording.dto'

export const Route = createFileRoute('/admin/status/')({
  component: StatusAdminPage
})

/** 台帳の合計サイズ。TB を超えたら TB 表記にする。 */
const formatSize = (bytes: number): string => {
  const gb = bytes / 1024 ** 3
  return gb >= 1024 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toFixed(1)} GB`
}

const recordStatusTone: Record<RecordStatus, RowTone> = {
  none: 'mute',
  pending: 'primary',
  downloading: 'info',
  completed: 'ok',
  failed: 'err',
  stale: 'warn',
  missing: 'mute'
}

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
    <PageContainer narrow className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.eyebrow.value} current={content.title.value} />}
        title={content.title.value}
        sub={content.description.value}
      />

      <div className='pt-3.5 max-sm:pt-1.5'>
        <PageSection title='Nagisa'>
          <FormHint>{content.nagisaSection.description.value}</FormHint>
          {status.isPending ? (
            <PageNotice tone='mute'>{content.loading.value}</PageNotice>
          ) : status.isError || status.data === undefined ? (
            <PageNotice tone='err'>{content.nagisaSection.error.value}</PageNotice>
          ) : (
            <StatGrid>
              <StatTile
                label={content.nagisaSection.version.value}
                value={`v${status.data.version}`}
                note={content.nagisaSection.uptimeNote({ uptime: formatUptime(status.data.uptime) }).value}
                tone='ok'
              />
              <StatTile
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
              <StatTile
                label={content.nagisaSection.cpuMemory.value}
                value={
                  status.data.system === null
                    ? content.unknown.value
                    : `${status.data.system.cpu_percent.toFixed(1)}% / ${status.data.system.memory_percent.toFixed(1)}%`
                }
                note={content.nagisaSection.cpuMemoryNote.value}
                tone={(status.data.system?.memory_percent ?? 0) >= 90 ? 'warn' : 'mute'}
              />
              <StatTile
                label={content.nagisaSection.diskFree.value}
                value={
                  status.data.system === null
                    ? content.unknown.value
                    : `${status.data.system.disk_free_gb.toFixed(1)} GB`
                }
                note={content.nagisaSection.diskFreeNote.value}
                tone={(status.data.system?.disk_free_gb ?? Number.POSITIVE_INFINITY) < 100 ? 'warn' : 'mute'}
              />
            </StatGrid>
          )}
        </PageSection>

        <PageSection title={content.queueSection.title.value}>
          <FormHint>{content.queueSection.description.value}</FormHint>
          {snapshot.isPending ? (
            <PageNotice tone='mute'>{content.loading.value}</PageNotice>
          ) : snapshot.isError || snapshot.data === undefined ? (
            <PageNotice tone='err'>{content.queueSection.error.value}</PageNotice>
          ) : (
            <>
              <StatGrid>
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
                    content.queueSection.waitingNote({ count: snapshot.data.counts.delayed.toLocaleString(appLocale) })
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
              </StatGrid>
              <FormHint>
                {content.queueSection.fetchedAt({
                  time: formatAbsolute(new Date(snapshot.data.generated_at * 1000).toISOString())
                })}
              </FormHint>
            </>
          )}
        </PageSection>

        <PageSection title={content.librarySection.title.value}>
          <FormHint>{content.librarySection.description.value}</FormHint>
          {stats.isPending ? (
            <PageNotice tone='mute'>{content.loading.value}</PageNotice>
          ) : stats.isError || stats.data === undefined ? (
            <PageNotice tone='err'>{content.librarySection.error.value}</PageNotice>
          ) : (
            <StatGrid>
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
              <StatTile
                label={content.librarySection.totalSize.value}
                value={formatSize(stats.data.total_size)}
                note={content.librarySection.totalSizeNote.value}
                tone='mute'
              />
              <StatTile
                label={content.librarySection.position.value}
                value={`seq ${stats.data.last_seq.toLocaleString(appLocale)}`}
                note={`epoch ${stats.data.epoch}`}
                tone='mute'
                mono
              />
            </StatGrid>
          )}
        </PageSection>

        <PageSection title={content.syncSection.title.value}>
          <FormHint>{content.syncSection.description.value}</FormHint>
          {sync.isPending ? (
            <PageNotice tone='mute'>{content.loading.value}</PageNotice>
          ) : sync.data === undefined ? (
            <PageNotice tone='err'>{content.syncSection.error.value}</PageNotice>
          ) : (
            <>
              {/*
              react-query は再取得に失敗しても直前の data を保持する。黙って出すと
              「同期が止まっている」と「同期状態を読めていない」が見分けられない。
            */}
              {sync.isError && <PageNotice tone='warn'>{content.syncSection.staleWarning.value}</PageNotice>}
              <StatGrid>
                <StatTile
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
                <StatTile
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
                <StatTile
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
              </StatGrid>
            </>
          )}
        </PageSection>

        {sync.data !== undefined && (
          <PageSection title={content.breakdownSection.title.value}>
            <FormHint>
              {sync.isError
                ? content.breakdownSection.descriptionError.value
                : content.breakdownSection.descriptionOk.value}
            </FormHint>
            <DataTable
              head={
                <>
                  <DataTh>{content.breakdownSection.status.value}</DataTh>
                  <DataTh right>{content.breakdownSection.count.value}</DataTh>
                  <DataTh>{content.breakdownSection.meaning.value}</DataTh>
                </>
              }
            >
              {RecordStatusEnum.options.map((s) => (
                <DataTr key={s} tone={recordStatusTone[s]}>
                  <DataTd>{recordStatusLabel[s]}</DataTd>
                  <DataTd right>{sync.data.counts[s].toLocaleString(appLocale)}</DataTd>
                  <DataTd sub>{recordStatusNote[s]}</DataTd>
                </DataTr>
              ))}
            </DataTable>
          </PageSection>
        )}
      </div>
    </PageContainer>
  )
}
