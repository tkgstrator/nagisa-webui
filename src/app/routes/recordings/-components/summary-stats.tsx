import { useIntlayer } from 'react-intlayer'

type Tone = 'primary' | 'ok' | 'warn' | 'mute'

const toneBorder: Record<Tone, string> = {
  primary: 'border-l-primary',
  ok: 'border-l-success',
  warn: 'border-l-warning',
  mute: 'border-l-border'
}

type StatProps = {
  tone: Tone
  label: string
  value: number
  unit: string
  /** 0〜100。指定したときだけ下に進捗バーを出す。 */
  ratio?: number
}

const Stat = ({ tone, label, value, unit, ratio }: StatProps) => (
  <div
    className={`flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5 ${value === 0 ? 'border-l-border' : toneBorder[tone]}`}
  >
    <div className='flex items-center gap-1.5 text-xs text-muted-foreground max-sm:text-[11.5px]'>
      <span className='min-w-0 truncate'>{label}</span>
    </div>
    <div
      className={`text-[28px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums max-sm:text-2xl ${value === 0 ? 'font-semibold text-muted-foreground' : ''}`}
    >
      {value}
      <small className='ml-1 text-[13px] font-medium tracking-normal text-muted-foreground'>{unit}</small>
    </div>
    {ratio === undefined ? null : (
      <div className='mt-1.5 h-1 overflow-hidden rounded-sm bg-muted'>
        <span className='block h-full bg-success transition-[width] duration-500' style={{ width: `${ratio}%` }} />
      </div>
    )}
  </div>
)

type SummaryStatsProps = {
  /** フィルタ適用後の総件数 (全ページ)。 */
  total: number
  /** 表示中のページ内で録画済みの作品数。 */
  recorded: number
  /** 表示中のページ内で未録画の作品数。 */
  pending: number
  /** 表示中のページ内で配信終了予定の作品数。 */
  expiring: number
  /** 配信終了予定のうち最短の残り日数。該当なしなら null。 */
  expiringSoonestDays: number | null
  /** 表示中のページの件数。 */
  visible: number
}

export const SummaryStats = ({
  total,
  recorded,
  pending,
  expiring,
  expiringSoonestDays,
  visible
}: SummaryStatsProps) => {
  const content = useIntlayer('recordings-summary-stats')
  return (
    <section
      className='grid grid-cols-4 gap-6 max-sm:grid-cols-2 max-sm:gap-x-3.5 max-sm:gap-y-4'
      aria-label={content.ariaLabel.value}
    >
      <Stat tone='primary' label={content.stats.scheduled.value} value={total} unit={content.unit.value} />
      <Stat
        tone='ok'
        label={content.stats.recordedVisible.value}
        value={recorded}
        unit={content.recordedUnit({ visible }).value}
        ratio={visible === 0 ? 0 : Math.round((recorded / visible) * 100)}
      />
      <Stat tone='mute' label={content.stats.pendingVisible.value} value={pending} unit={content.unit.value} />
      <Stat
        tone='warn'
        label={content.stats.expiringVisible.value}
        value={expiring}
        unit={
          expiringSoonestDays === null
            ? content.unit.value
            : content.expiringUnitWithDays({ days: expiringSoonestDays }).value
        }
      />
    </section>
  )
}
