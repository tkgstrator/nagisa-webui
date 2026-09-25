import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'

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

const segButtonClass =
  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:-outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring'
const segPressedClass = 'bg-accent font-semibold text-accent-foreground'

const toggleClass =
  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
const togglePressedClass = 'bg-warning font-semibold text-warning-foreground'
const toggleIdleClass = 'text-muted-foreground hover:bg-muted hover:text-foreground'

const chipClass =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'

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
      <fieldset
        className='inline-flex rounded-lg border border-border bg-background p-0.5 max-sm:w-full max-sm:overflow-x-auto'
        aria-label={content.ariaLabels.recordedStatus.value}
      >
        {RECORDED_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type='button'
            aria-pressed={recordedFilter === value}
            onClick={() => onRecordedFilterChange(value)}
            className={`${segButtonClass} ${recordedFilter === value ? segPressedClass : ''}`}
          >
            {label}
          </button>
        ))}
      </fieldset>

      <fieldset className='inline-flex flex-wrap gap-1.5 border-0 p-0' aria-label={content.ariaLabels.provider.value}>
        {PROVIDERS.map((key) => {
          const pressed = provider === key
          return (
            <button
              key={key}
              type='button'
              aria-pressed={pressed}
              onClick={() => onProviderChange(pressed ? undefined : key)}
              className={`${chipClass} ${pressed ? `border-transparent font-semibold ${providerColor[key] ?? ''}` : ''}`}
            >
              <i className={`size-2 shrink-0 rounded-full bg-current ${pressed ? 'opacity-100' : 'opacity-55'}`} />
              {providerLabel[key] ?? key}
            </button>
          )
        })}
      </fieldset>

      <button
        type='button'
        aria-pressed={expiringOnly}
        onClick={() => onExpiringOnlyChange(!expiringOnly)}
        className={`${toggleClass} ${expiringOnly ? togglePressedClass : toggleIdleClass}`}
      >
        {content.expiringOnly}
      </button>

      <button
        type='button'
        aria-pressed={showFinished}
        onClick={() => onShowFinishedChange(!showFinished)}
        className={`${toggleClass} ${showFinished ? togglePressedClass : toggleIdleClass}`}
      >
        {content.showFinished}
      </button>

      <button
        type='button'
        onClick={onReset}
        disabled={!hasActiveFilters}
        className='inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground'
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
      </button>

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
