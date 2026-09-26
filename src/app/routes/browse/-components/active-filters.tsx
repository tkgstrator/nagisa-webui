import { SlidersHorizontal } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { ActiveFilterChip } from '@/app/components/ui/active-filter-chip'
import { cn } from '@/app/lib/utils'
import type { ActiveChip } from '../-lib/filters'

export type ActiveFiltersProps = {
  hasFilters: boolean
  activeChips: ActiveChip[]
  onOpenFilterSheet: () => void
  onResetFilters: () => void
}

/** サイドバーに絞り込みパネルがある画面幅では、未絞り込みの行は出すものが無いので畳む。 */
export const ActiveFilters = ({ hasFilters, activeChips, onOpenFilterSheet, onResetFilters }: ActiveFiltersProps) => {
  const content = useIntlayer('browse-active-filters')

  return (
    <div className={cn('flex min-h-[26px] flex-wrap items-center gap-1.5 text-xs', !hasFilters && 'sm:hidden')}>
      <button
        type='button'
        onClick={onOpenFilterSheet}
        className='inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs text-foreground sm:hidden'
      >
        <SlidersHorizontal className='size-3' aria-hidden='true' />
        {content.openFilters}
        {hasFilters && (
          <span className='rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums'>
            {activeChips.length}
          </span>
        )}
      </button>

      {hasFilters && (
        <>
          <span className='text-muted-foreground max-sm:hidden'>{content.applied}</span>
          {activeChips.map((chip) => (
            <ActiveFilterChip
              key={chip.key}
              label={chip.label}
              value={chip.value}
              dot={chip.dot}
              query={chip.query}
              onClear={chip.onClear}
              clearLabel={content.clearChipLabel({ label: chip.label, value: chip.value }).value}
            />
          ))}
          <button
            type='button'
            onClick={onResetFilters}
            className='ml-1 rounded-md px-2 py-1 text-xs leading-[18px] text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            {content.clearAll}
          </button>
        </>
      )}
    </div>
  )
}
