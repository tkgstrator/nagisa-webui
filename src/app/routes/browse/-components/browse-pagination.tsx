import { useIntlayer } from 'react-intlayer'
import { SmartPagination } from '@/app/components/smart-pagination'

/** 表示件数の選択肢。決定稿モックの .perpage と同じ 3 段。 */
const PAGE_SIZE_OPTIONS = [24, 48, 96] as const

export type BrowsePaginationProps = {
  total: number
  rangeStart: number
  rangeEnd: number
  pageSize: number
  page: number
  totalPages: number
  onChangePageSize: (size: number) => void
  onPageChange: (page: number) => void
}

export const BrowsePagination = ({
  total,
  rangeStart,
  rangeEnd,
  pageSize,
  page,
  totalPages,
  onChangePageSize,
  onPageChange
}: BrowsePaginationProps) => {
  const content = useIntlayer('browse-browse-pagination')

  if (total === 0) return null
  return (
    <nav aria-label={content.ariaLabel.value} className='flex flex-wrap items-center gap-4 max-sm:gap-2.5'>
      <div className='text-xs text-muted-foreground tabular-nums'>
        <b className='font-semibold text-foreground'>
          {rangeStart}–{rangeEnd}
        </b>{' '}
        {content.rangeOf({ total })}
      </div>
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        {content.pageSizeLabel}
        <fieldset aria-label={content.pageSizeLabel.value} className='inline-flex gap-0.5 rounded-[7px] bg-muted p-0.5'>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type='button'
              aria-pressed={pageSize === size}
              onClick={() => onChangePageSize(size)}
              className='inline-flex h-[22px] items-center rounded-[5px] px-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums transition-colors hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_var(--overlay)]'
            >
              {size}
            </button>
          ))}
        </fieldset>
      </div>
      {totalPages > 1 && (
        <div className='ml-auto max-sm:ml-0 max-sm:w-full'>
          <SmartPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </nav>
  )
}
