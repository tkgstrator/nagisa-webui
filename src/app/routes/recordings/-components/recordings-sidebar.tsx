import { useIntlayer } from 'react-intlayer'
import { SidebarSlot } from '@/app/components/app-sidebar'
import { StatusDot } from '@/app/components/ui/status-dot'
import type { Tone } from '@/app/components/ui/tone'
import type { RecordedFilter } from './recordings-toolbar'

type StatProps = {
  tone: Tone
  label: string
  value: number
  onSelect: () => void
}

const Stat = ({ tone, label, value, onSelect }: StatProps) => (
  <button
    type='button'
    onClick={onSelect}
    className='flex w-full items-center gap-2 rounded-r-lg border-l-[3px] border-l-transparent px-2.5 py-[7px] text-left text-[12.5px] text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring'
  >
    <StatusDot aria-hidden='true' tone={tone} />
    {label}
    <span className='ml-auto font-bold tabular-nums'>{value}</span>
  </button>
)

type RecordingsSidebarProps = {
  /** 予約中の総件数 (フィルタ適用後・全ページ)。 */
  total: number
  /** 表示中のページ内で録画済みの作品数。 */
  recorded: number
  /** 表示中のページ内で未録画の作品数。 */
  pending: number
  onFilterChange: (value: RecordedFilter) => void
}

export const RecordingsSidebar = ({ total, recorded, pending, onFilterChange }: RecordingsSidebarProps) => {
  const content = useIntlayer('recordings-recordings-sidebar')
  return (
    <SidebarSlot>
      <div className='border-t border-border pt-3.5 max-sm:hidden'>
        <h3 className='px-2.5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase'>
          {content.heading}
        </h3>
        <Stat tone='warning' label={content.scheduled.value} value={total} onSelect={() => onFilterChange('all')} />
        <Stat
          tone='success'
          label={content.recorded.value}
          value={recorded}
          onSelect={() => onFilterChange('recorded')}
        />
        <Stat tone='info' label={content.pending.value} value={pending} onSelect={() => onFilterChange('pending')} />
      </div>
    </SidebarSlot>
  )
}
