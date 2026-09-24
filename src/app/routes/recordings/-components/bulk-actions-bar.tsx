import { useIntlayer } from 'react-intlayer'

type BulkActionsBarProps = {
  allVisibleSelected: boolean
  onToggleAllVisible: () => void
  selectedCount: number
  disabled: boolean
  onBulkUnschedule: () => void
}

export const BulkActionsBar = ({
  allVisibleSelected,
  onToggleAllVisible,
  selectedCount,
  disabled,
  onBulkUnschedule
}: BulkActionsBarProps) => {
  const content = useIntlayer('recordings-bulk-actions-bar')
  return (
    <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-2 text-xs text-muted-foreground'>
      <label className='inline-flex cursor-pointer items-center gap-2'>
        <input
          type='checkbox'
          checked={allVisibleSelected}
          onChange={onToggleAllVisible}
          aria-label={content.selectAllVisible.value}
          className='size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
        />
        {content.selectAllVisible}
      </label>
      <span className='tabular-nums'>
        <b className='font-bold text-foreground'>{selectedCount}</b>
        {content.selectedSuffix}
      </span>
      <div className='ml-auto inline-flex flex-wrap items-center gap-2 max-sm:ml-0 max-sm:w-full'>
        <button
          type='button'
          disabled={disabled}
          onClick={onBulkUnschedule}
          className='inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs whitespace-nowrap text-destructive transition-colors hover:bg-status-cancelled focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-default disabled:opacity-45 disabled:hover:bg-background'
        >
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2.2'
            strokeLinecap='round'
            className='size-[13px]'
            aria-hidden='true'
          >
            <path d='M6 6l12 12M18 6 6 18' />
          </svg>
          {content.bulkUnschedule}
        </button>
      </div>
    </div>
  )
}
