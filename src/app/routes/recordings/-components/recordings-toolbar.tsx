import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
import { OptionSelect } from '@/app/components/option-select'
import { SortControl } from '@/app/components/sort-control'
import { Button } from '@/app/components/ui/button'
import { Chip } from '@/app/components/ui/chip'
import { providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import { cn } from '@/app/lib/utils'

const moduleContent = getIntlayer('recordings-recordings-toolbar', appLocale)

export type RecordedFilter = 'all' | 'recorded' | 'pending'

/** API の sort / order をひとつの select にまとめるための値。 */
export type SortKey = 'updatedAt' | 'title' | 'year'
export type SortValue = `${SortKey}-${'asc' | 'desc'}`

export const SORT_KEYS: { value: SortKey; label: string }[] = [
  { value: 'updatedAt', label: moduleContent.sortOptions.updated },
  { value: 'title', label: moduleContent.sortOptions.title },
  { value: 'year', label: moduleContent.sortOptions.year }
]

export const PROVIDERS = ['amazon', 'hulu', 'crunchyroll', 'abema', 'netflix']

/** 「すべて」を表す select の値。外側の状態は provider === undefined のまま。 */
const ALL_PROVIDERS = '__all__'
const PROVIDER_OPTIONS = [
  { value: ALL_PROVIDERS, label: moduleContent.allProviders },
  ...PROVIDERS.map((key) => ({ value: key, label: providerLabel[key] ?? key }))
]

/** 選択中は配信元チップと同じく塗りつぶす。配信終了予定は warning 色で示す。 */
const toggleClass = 'h-[34px] px-3 text-[12.5px]'
const togglePressedClass =
  'border-transparent bg-warning text-warning-foreground hover:bg-warning hover:text-warning-foreground'

type RecordingsToolbarProps = {
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
      <div className='inline-flex items-center gap-1.5 text-xs text-muted-foreground max-sm:w-full'>
        <OptionSelect
          label={content.ariaLabels.provider.value}
          value={provider ?? ALL_PROVIDERS}
          options={PROVIDER_OPTIONS}
          onValueChange={(next) => onProviderChange(next === ALL_PROVIDERS ? undefined : next)}
          className='max-sm:min-w-0 max-sm:flex-1'
        />
      </div>

      <Chip
        type='button'
        aria-pressed={expiringOnly}
        onClick={() => onExpiringOnlyChange(!expiringOnly)}
        className={cn(toggleClass, expiringOnly && togglePressedClass)}
      >
        {content.expiringOnly}
      </Chip>

      <Chip
        type='button'
        aria-pressed={showFinished}
        onClick={() => onShowFinishedChange(!showFinished)}
        className={cn(toggleClass, showFinished && togglePressedClass)}
      >
        {content.showFinished}
      </Chip>

      <Button
        type='button'
        variant='outline'
        size='icon'
        onClick={onReset}
        disabled={!hasActiveFilters}
        aria-label={content.reset.value}
        title={content.reset.value}
        className='size-[34px] rounded-full border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0 disabled:cursor-default disabled:hover:bg-background disabled:hover:text-muted-foreground'
      >
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          className='size-4'
          aria-hidden='true'
        >
          <path d='M3 12a9 9 0 1 0 3-6.7M3 4v4h4' />
        </svg>
      </Button>

      <span className='min-w-0 flex-1 max-sm:hidden' />

      <div className='inline-flex items-center gap-1.5 text-xs text-muted-foreground max-sm:w-full'>
        <SortControl
          label={content.sortLabel.value}
          value={sort}
          keys={SORT_KEYS}
          compact
          onValueChange={(next) => onSortChange(next as SortValue)}
          className='max-sm:min-w-0 max-sm:flex-1'
        />
      </div>
    </fieldset>
  )
}
