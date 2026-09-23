import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PageContainer } from '@/app/components/page-container'
import { StatTile } from '@/app/components/stat-tile'
import { recordStatusAccent, recordStatusLabel, recordStatusNote } from '@/app/lib/constants'
import {
  nagisaLibraryStatsQueryOptions,
  nagisaQueueSnapshotQueryOptions,
  nagisaStatusQueryOptions,
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

/** 秒 → 「3 日 4 時間」。分未満は切り捨てて「1 分未満」に畳む。 */
const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3_600)
  const m = Math.floor((seconds % 3_600) / 60)
  if (d > 0) return `${d} 日 ${h} 時間`
  if (h > 0) return `${h} 時間 ${m} 分`
  return m > 0 ? `${m} 分` : '1 分未満'
}

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
  // 上流 (nagisa) を叩く 3 本は落ちていることが正常系なので、失敗を画面に出すだけで
  // ページ全体は落とさない。sync-state はローカル D1 だけなので必ず返る。
  const status = useQuery(nagisaStatusQueryOptions())
  const snapshot = useQuery(nagisaQueueSnapshotQueryOptions())
  const stats = useQuery(nagisaLibraryStatsQueryOptions())
  const sync = useQuery(recordingSyncStateQueryOptions())

  // ロックは期限を見ないと意味が反転する。同期が異常終了すると lease_until だけが
  // 残るので、「非 null = 実行中」と読むと止まっているものが走って見える。
  const leaseUntil = sync.data?.leaseUntil ?? null
  const leaseExpired = leaseUntil !== null && new Date(leaseUntil).getTime() <= Date.now()

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>サーバーステータス</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          Nagisa の稼働状況・キュー・録画台帳と、WebUI 側がどこまで同期できているか
        </p>
      </header>

      <Section title='Nagisa' description='GET /api/status。落ちていればここだけが取得できなくなる'>
        {status.isPending ? (
          <Notice tone='mute'>取得中…</Notice>
        ) : status.isError || status.data === undefined ? (
          <Notice tone='err'>Nagisa に接続できません (Service Auth / BACKEND_URL を確認)</Notice>
        ) : (
          <div className={tileGrid}>
            <Field
              label='バージョン'
              value={`v${status.data.version}`}
              note={`稼働 ${formatUptime(status.data.uptime)}`}
              tone='ok'
            />
            <Field
              label='Redis'
              value={status.data.redis === null ? '不明' : status.data.redis.connected ? '接続' : '切断'}
              note={
                status.data.redis === null ? 'nagisa が情報を返していない' : `メモリ ${status.data.redis.memory_used}`
              }
              tone={status.data.redis?.connected === true ? 'ok' : 'err'}
            />
            <Field
              label='CPU / メモリ'
              value={
                status.data.system === null
                  ? '不明'
                  : `${status.data.system.cpu_percent.toFixed(1)}% / ${status.data.system.memory_percent.toFixed(1)}%`
              }
              note='ホストの使用率'
              tone={(status.data.system?.memory_percent ?? 0) >= 90 ? 'warn' : 'mute'}
            />
            <Field
              label='ディスク空き'
              value={status.data.system === null ? '不明' : `${status.data.system.disk_free_gb.toFixed(1)} GB`}
              note='録画先の空き容量'
              tone={(status.data.system?.disk_free_gb ?? Number.POSITIVE_INFINITY) < 100 ? 'warn' : 'mute'}
            />
          </div>
        )}
      </Section>

      <Section
        title='キュー'
        description='GET /api/queue/snapshot。completed / failed は保持期間で落ちるので件数は目安 (完了の根拠は台帳)'
      >
        {snapshot.isPending ? (
          <Notice tone='mute'>取得中…</Notice>
        ) : snapshot.isError || snapshot.data === undefined ? (
          <Notice tone='err'>キューのスナップショットを取得できません</Notice>
        ) : (
          <>
            <div className={tileGrid}>
              <StatTile
                label='実行中'
                value={snapshot.data.counts.active}
                unit='件'
                note='ダウンロード中'
                tone='primary'
              />
              <StatTile
                label='待機'
                value={snapshot.data.counts.wait + snapshot.data.counts.delayed}
                unit='件'
                note={`うち遅延 ${snapshot.data.counts.delayed.toLocaleString('ja-JP')} 件`}
                tone='warn'
              />
              <StatTile
                label='失敗'
                value={snapshot.data.counts.failed}
                unit='件'
                note='キューに残っている失敗'
                tone='err'
              />
              <StatTile
                label='完了'
                value={snapshot.data.counts.completed}
                unit='件'
                note='保持期間内のもののみ'
                tone='ok'
              />
            </div>
            <p className='text-xs text-muted-foreground'>
              取得時刻 {formatAbsolute(new Date(snapshot.data.generated_at * 1000).toISOString())}
            </p>
          </>
        )}
      </Section>

      <Section title='録画台帳 (Nagisa)' description='GET /api/library/stats。実体のファイルを数えたもの'>
        {stats.isPending ? (
          <Notice tone='mute'>取得中…</Notice>
        ) : stats.isError || stats.data === undefined ? (
          <Notice tone='err'>台帳の集計を取得できません</Notice>
        ) : (
          <div className={tileGrid}>
            <StatTile
              label='録画ファイル'
              value={stats.data.recordings}
              unit='件'
              note='台帳が把握している実体'
              tone='ok'
            />
            <StatTile
              label='未解決'
              value={stats.data.unresolved}
              unit='件'
              note='provider / episode_id を当てられていない'
              tone='warn'
            />
            <Field label='合計サイズ' value={formatSize(stats.data.total_size)} note='ライブラリ全体' />
            <Field
              label='台帳の位置'
              value={`seq ${stats.data.last_seq.toLocaleString('ja-JP')}`}
              note={`epoch ${stats.data.epoch}`}
              mono
            />
          </div>
        )}
      </Section>

      <Section title='WebUI 側の同期' description='ローカル D1 だけを見るので、Nagisa が落ちていてもここは必ず出る'>
        {sync.isPending ? (
          <Notice tone='mute'>取得中…</Notice>
        ) : sync.data === undefined ? (
          <Notice tone='err'>同期状態を取得できません</Notice>
        ) : (
          <>
            {/*
              react-query は再取得に失敗しても直前の data を保持する。黙って出すと
              「同期が止まっている」と「同期状態を読めていない」が見分けられない。
            */}
            {sync.isError && <Notice tone='warn'>再取得に失敗しています (以下は直前に取得できた内容)</Notice>}
            <div className={tileGrid}>
              <Field
                label='最終成功'
                value={sync.data.lastSucceededAt === null ? '未実行' : formatRelative(sync.data.lastSucceededAt)}
                note={
                  sync.data.lastSucceededAt === null
                    ? '一度も完走していない'
                    : formatAbsolute(sync.data.lastSucceededAt)
                }
                tone={sync.data.lastSucceededAt === null ? 'err' : 'ok'}
              />
              <Field
                label='カーソル'
                value={
                  sync.data.snapshotCursor !== null
                    ? '初回取り込み中'
                    : sync.data.cursor === null
                      ? '未取得'
                      : '差分を追跡中'
                }
                note={
                  sync.data.snapshotCursor !== null && sync.data.snapshotStartedAt !== null
                    ? `${formatRelative(sync.data.snapshotStartedAt)}に開始`
                    : sync.data.cursor === null
                      ? '台帳同期をまだ走らせていない'
                      : '差分カーソルを保持している'
                }
                tone={sync.data.cursor === null && sync.data.snapshotCursor === null ? 'warn' : 'mute'}
              />
              <Field
                label='実行ロック'
                value={leaseUntil === null ? '空き' : leaseExpired ? '期限切れ' : '実行中'}
                note={
                  leaseUntil === null
                    ? '同期は走っていない'
                    : leaseExpired
                      ? `${sync.data.leaseOwner ?? '不明'} が ${formatRelative(leaseUntil)}に失効 (異常終了の疑い)`
                      : `${sync.data.leaseOwner ?? '不明'} / ${formatAbsolute(leaseUntil)}まで`
                }
                tone={leaseExpired ? 'warn' : 'mute'}
              />
              <StatTile
                label='追跡中'
                value={sync.data.tracked}
                unit='件'
                note='job id を持つ待機 / 実行中'
                tone='primary'
              />
            </div>
          </>
        )}
      </Section>

      {sync.data !== undefined && (
        <Section
          title='録画状態の内訳'
          description={
            sync.isError
              ? 'エピソード単位。再取得に失敗しているので、以下は直前に取得できた件数'
              : 'エピソード単位。completed を書けるのは台帳同期だけ'
          }
        >
          <div className='overflow-x-auto'>
            <table className='w-full border-collapse text-[13px]'>
              <thead>
                <tr className='border-b border-border'>
                  <th scope='col' className={`${headClass} pl-[13px]`}>
                    状態
                  </th>
                  <th scope='col' className={`${headClass} text-right`}>
                    件数
                  </th>
                  <th scope='col' className={headClass}>
                    意味
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
