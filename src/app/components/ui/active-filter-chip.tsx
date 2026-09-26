import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils'

type ActiveFilterChipProps = {
  label: string
  value: string
  dot?: string
  query?: boolean
  clearLabel: string
  onClear: () => void
}

/** Mock Diff の filter-chips にある、解除ボタン付きの適用中フィルタ。 */
export const ActiveFilterChip = ({ label, value, dot, query, clearLabel, onClear }: ActiveFilterChipProps) => (
  <span
    className={cn(
      'inline-flex h-6 items-center gap-1 rounded-md pr-1 pl-2.5 text-xs',
      query ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
    )}
  >
    {dot !== undefined && <span aria-hidden='true' className={cn('size-[7px] rounded-full', dot)} />}
    <span className={query ? 'opacity-65' : 'text-muted-foreground'}>{label}</span>
    <span className='max-w-40 truncate'>{value}</span>
    <button
      type='button'
      onClick={onClear}
      aria-label={clearLabel}
      className='grid size-[18px] place-items-center rounded-sm text-muted-foreground hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
    >
      <X className='size-[11px]' />
    </button>
  </span>
)
