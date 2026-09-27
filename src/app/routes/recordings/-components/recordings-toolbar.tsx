import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
import { Button } from '@/app/components/ui/button'
import { Chip } from '@/app/components/ui/chip'
import { StatusDot } from '@/app/components/ui/status-dot'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import { cn } from '@/app/lib/utils'

const moduleContent = getIntlayer('recordings-recordings-toolbar', appLocale)

export type RecordedFilter = 'all' | 'recorded' | 'pending'

export const RECORDED_OPTIONS: { value: RecordedFilter; label: string }[] = [
  { value: 'all', label: moduleContent.recordedOptions.all },
  { value: 'pending', label: moduleContent.recordedOptions.pending },
  { value: 'recorded', label: moduleContent.recordedOptions.recorded }
]

/** API の sort / order をひとつの select にまとめるための値。 */
export type SortValue = 'updatedAt-desc' | 'updatedAt-asc' | 'title-asc' | 'year-desc' | 'year-asc'

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'updatedAt-desc', label: moduleContent.sortOptions.updatedDesc },
  { value: 'updatedAt-asc', label: moduleContent.sortOptions.updatedAsc },
  { value: 'title-asc', label: moduleContent.sortOptions.titleAsc },
  { value: 'year-desc', label: moduleContent.sortOptions.yearDesc },
  { value: 'year-asc', label: moduleContent.sortOptions.yearAsc }
]

export const PROVIDERS = ['amazon', 'hulu', 'crunchyroll', 'abema', 'netflix']

const toggleClass =
  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
const togglePressedClass = 'bg-warning font-semibold text-warning-foreground'
const toggleIdleClass = 'text-muted-foreground hover:bg-muted hover:text-foreground'

type RecordingsToolbarProps = {
  recordedFilter: RecordedFilter
  onRecordedFilterChange: (value: RecordedFilter) => void
  provider: string | undefined
  onProviderChange: (value: string | undefined) => void
  expiringOnly: boolean
  onExpiringOnlyChange: (value: boolean) => void
  showFinished: boolean
  onShowFinishedChange: (value: boolean) => void
  sort: SortValue
  onSortChange: (value: SortValue) => void
  hasActiveFilters: boolean
  onReset: () => void
}

export const RecordingsToolbar = ({
  recordedFilter,
  onRecordedFilterChange,
  provider,
  onProviderChange,
  expiringOnly,
  onExpiringOnlyChange,
  showFinished,
  onShowFinishedChange,
  sort,
  onSortChange,
  hasActiveFilters,
  onReset
}: RecordingsToolbarProps) => {
  const content = useIntlayer('recordings-recordings-toolbar')
  return (
    <fieldset
      className='flex flex-wrap items-center gap-x-2.5 gap-y-2 border-0 p-0'
      aria-label={content.ariaLabels.filterAndSort.value}
    >
      <ToggleGroup
        value={[recordedFilter]}
        onValueChange={(values) => values[0] && onRecordedFilterChange(values[0] as RecordedFilter)}
        aria-label={content.ariaLabels.recordedStatus.value}
        className='max-sm:w-full max-sm:overflow-x-auto'
      >
        {RECORDED_OPTIONS.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <fieldset className='inline-flex flex-wrap gap-1.5 border-0 p-0' aria-label={content.ariaLabels.provider.value}>
        {PROVIDERS.map((key) => {
          const pressed = provider === key
          return (
            <Chip
              key={key}
              type='button'
              aria-pressed={pressed}
              onClick={() => onProviderChange(pressed ? undefined : key)}
              className={pressed ? providerColor[key] : undefined}
            >
              <StatusDot
                aria-hidden='true'
                size='lg'
                className={cn('bg-current', pressed ? 'opacity-100' : 'opacity-55')}
              />
              {providerLabel[key] ?? key}
            </Chip>
          )
        })}
      </fieldset>

      <button
        type='button'
        aria-pressed={expiringOnly}
        onClick={() => onExpiringOnlyChange(!expiringOnly)}
        className={cn(toggleClass, expiringOnly ? togglePressedClass : toggleIdleClass)}
      >
        {content.expiringOnly}
      </button>

      <button
        type='button'
        aria-pressed={showFinished}
        onClick={() => onShowFinishedChange(!showFinished)}
        className={cn(toggleClass, showFinished ? togglePressedClass : toggleIdleClass)}
      >
        {content.showFinished}
      </button>

      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={onReset}
        disabled={!hasActiveFilters}
        className='disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-muted-foreground'
      >
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          className='size-3.5'
          aria-hidden='true'
        >
          <path d='M3 12a9 9 0 1 0 3-6.7M3 4v4h4' />
        </svg>
        {content.reset}
      </Button>

      <span className='min-w-0 flex-1 max-sm:hidden' />

      <label className='inline-flex items-center gap-1.5 text-xs text-muted-foreground max-sm:w-full'>
        {content.sortLabel}
        <span className='relative inline-flex max-sm:min-w-0 max-sm:flex-1'>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortValue)}
            className='h-[30px] w-full appearance-none rounded-lg border border-input bg-background pr-7 pl-2.5 text-xs text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-ring'
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='pointer-events-none absolute top-1/2 right-2.5 size-2.5 -translate-y-1/2 text-muted-foreground'
            aria-hidden='true'
          >
            <path d='m6 9 6 6 6-6' />
          </svg>
        </span>
      </label>
    </fieldset>
  )
}
