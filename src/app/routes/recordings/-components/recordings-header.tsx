import { useIntlayer } from 'react-intlayer'

type RecordingsHeaderProps = {
  /** 予約中の総件数 (フィルタ適用後・全ページ)。 */
  total: number
  search: string
  onSearchChange: (value: string) => void
}

export const RecordingsHeader = ({ total, search, onSearchChange }: RecordingsHeaderProps) => {
  const content = useIntlayer('recordings-recordings-header')
  return (
    <header className='flex flex-wrap items-end justify-between gap-5'>
      <div>
        <h1 className='text-[28px] leading-tight font-bold tracking-[-0.02em]'>{content.title}</h1>
        <p className='mt-1 text-xs text-muted-foreground'>
          <span className='tabular-nums'>{total}</span>
          {content.scheduledSuffix}
        </p>
      </div>
      <label className='relative max-w-[360px] flex-[1_1_260px] max-sm:max-w-none max-sm:flex-[1_1_100%]'>
        <span className='sr-only'>{content.searchLabel}</span>
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          className='pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground'
          aria-hidden='true'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m20 20-3.5-3.5' />
        </svg>
        <input
          type='search'
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={content.searchPlaceholder.value}
          className='h-[34px] w-full rounded-lg border border-input bg-background pr-[30px] pl-8 text-[13px] text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-ring'
        />
      </label>
    </header>
  )
}
