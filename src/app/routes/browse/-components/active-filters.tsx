import { SlidersHorizontal, X } from 'lucide-react'
import type { ActiveChip } from '../-lib/filters'

export type ActiveFiltersProps = {
  hasFilters: boolean
  activeChips: ActiveChip[]
  onOpenFilterSheet: () => void
  onResetFilters: () => void
}

/** サイドバーに絞り込みパネルがある画面幅では、未絞り込みの行は出すものが無いので畳む。 */
export const ActiveFilters = ({ hasFilters, activeChips, onOpenFilterSheet, onResetFilters }: ActiveFiltersProps) => (
  <div className={`flex min-h-[26px] flex-wrap items-center gap-1.5 text-xs ${hasFilters ? '' : 'sm:hidden'}`}>
    <button
      type='button'
      onClick={onOpenFilterSheet}
      className='inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs text-foreground sm:hidden'
    >
      <SlidersHorizontal className='size-3' aria-hidden='true' />
      絞り込み
      {hasFilters && (
        <span className='rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums'>
          {activeChips.length}
        </span>
      )}
    </button>

    {hasFilters && (
      <>
        <span className='text-muted-foreground max-sm:hidden'>適用中</span>
        {activeChips.map((chip) => (
          <span
            key={chip.key}
            className={`inline-flex h-6 items-center gap-1 rounded-md pr-1 pl-2.5 text-xs ${
              chip.query ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {chip.dot !== undefined && <span aria-hidden='true' className={`size-[7px] rounded-full ${chip.dot}`} />}
            <span className={chip.query ? 'opacity-65' : 'text-muted-foreground'}>{chip.label}</span>
            <span className='max-w-40 truncate'>{chip.value}</span>
            <button
              type='button'
              onClick={chip.onClear}
              aria-label={`${chip.label} ${chip.value} を解除`}
              className='grid size-[18px] place-items-center rounded-sm text-muted-foreground hover:bg-border hover:text-foreground'
            >
              <X className='size-[11px]' />
            </button>
          </span>
        ))}
        <button
          type='button'
          onClick={onResetFilters}
          className='ml-1 rounded-md px-2 py-1 text-xs leading-[18px] text-muted-foreground hover:bg-muted hover:text-foreground'
        >
          すべて解除
        </button>
      </>
    )}
  </div>
)
