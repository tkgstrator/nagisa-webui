import { Link } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'
import { Button, buttonVariants } from '@/app/components/ui/button'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { cn } from '@/app/lib/utils'

type RecordingsEmptyProps = {
  /** 絞り込みの結果 0 件なのか、そもそも予約が 1 件も無いのか。 */
  filtered: boolean
  /** 絞り込み時に表示する、適用中の条件ラベル。 */
  terms: string[]
  onReset: () => void
}

export const RecordingsEmpty = ({ filtered, terms, onReset }: RecordingsEmptyProps) => {
  const content = useIntlayer('recordings-recordings-empty')
  const variant = filtered ? content.filtered : content.empty
  return (
    <div
      className={cn(
        'flex items-start gap-4 border-l-[3px] bg-muted/45 py-6 pr-[22px] pl-[19px] max-sm:px-4',
        filtered ? 'border-l-primary' : 'border-l-border'
      )}
    >
      <div
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-md',
          filtered ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
        )}
      >
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='size-5'
          aria-hidden='true'
        >
          {filtered ? <path d='M3 5h18l-7 8v6l-4 2v-8z' /> : <path d='M12 3a9 9 0 1 0 9 9M12 7v5l3 2' />}
        </svg>
      </div>
      <div className='min-w-0 flex-1'>
        <h2 className='text-[15px] font-bold tracking-[-0.01em]'>{variant.title}</h2>
        <p className='mt-1.5 max-w-[56ch] text-[12.5px] leading-[1.75] text-muted-foreground max-sm:max-w-none'>
          {variant.description}
        </p>
        {terms.length === 0 ? null : (
          <div className='mt-[11px] flex flex-wrap gap-1.5'>
            {terms.map((term) => (
              <StatusBadge key={term} size='sm' tone='primary' className='h-[22px] rounded px-2 text-[11.5px]'>
                {term}
              </StatusBadge>
            ))}
          </div>
        )}
        <div className='mt-3.5 flex flex-wrap gap-2'>
          {filtered ? (
            <Button type='button' onClick={onReset} className='h-8 rounded-md px-[13px] text-[12.5px]'>
              {content.reset}
            </Button>
          ) : null}
          <Link
            to='/browse'
            className={cn(
              buttonVariants({ variant: filtered ? 'outline' : 'default' }),
              'h-8 rounded-md px-[13px] text-[12.5px]'
            )}
          >
            {content.browse}
          </Link>
        </div>
      </div>
    </div>
  )
}
