import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { appLocale } from '@/app/lib/locale'

const pagerButtonClass =
  'grid size-[34px] place-items-center rounded-full border border-border text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-90 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[15px]'

/**
 * 決定稿の `.pager`。前後ボタンと「1 / 5 ページ · 42件」だけの最小のページ送り。
 * 1 ページに収まるときは出さない。
 */
export const PagePager = ({
  page,
  totalPages,
  total,
  onPageChange
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) => {
  const content = useIntlayer('page-pager')
  if (totalPages <= 1) return null
  return (
    <nav className='flex items-center justify-center gap-[18px] max-sm:gap-3'>
      <button
        type='button'
        className={pagerButtonClass}
        disabled={page <= 1}
        aria-label={content.previous.value}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </button>
      <span className='text-[13px] text-muted-foreground tabular-nums max-sm:text-xs'>
        <b className='font-bold text-foreground'>{page}</b>
        {content.pages({ totalPages, total: total.toLocaleString(appLocale) })}
      </span>
      <button
        type='button'
        className={pagerButtonClass}
        disabled={page >= totalPages}
        aria-label={content.next.value}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </button>
    </nav>
  )
}
