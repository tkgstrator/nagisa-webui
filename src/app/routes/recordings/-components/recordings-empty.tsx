import { Link } from '@tanstack/react-router'

const btnClass =
  'inline-flex h-8 items-center rounded-md border border-border bg-background px-[13px] text-[12.5px] font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
const btnPrimaryClass =
  'inline-flex h-8 items-center rounded-md border border-transparent bg-primary px-[13px] text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'

type RecordingsEmptyProps = {
  /** 絞り込みの結果 0 件なのか、そもそも予約が 1 件も無いのか。 */
  filtered: boolean
  /** 絞り込み時に表示する、適用中の条件ラベル。 */
  terms: string[]
  onReset: () => void
}

export const RecordingsEmpty = ({ filtered, terms, onReset }: RecordingsEmptyProps) => (
  <div
    className={`flex items-start gap-4 bg-muted/45 py-6 pr-[22px] pl-[19px] max-sm:px-4 ${filtered ? 'border-l-[3px] border-l-primary' : 'border-l-[3px] border-l-border'}`}
  >
    <div
      className={`grid size-10 shrink-0 place-items-center rounded-md ${filtered ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
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
      <h2 className='text-[15px] font-bold tracking-[-0.01em]'>
        {filtered ? '条件に合う録画予約はありません' : 'まだ録画予約がありません'}
      </h2>
      <p className='mt-1.5 max-w-[56ch] text-[12.5px] leading-[1.75] text-muted-foreground max-sm:max-w-none'>
        {filtered
          ? '絞り込みを緩めるか、条件をリセットしてください。予約中の作品はプロバイダや録画状態をまたいで保持されています。'
          : 'アニメ一覧から作品を開き、録画予約をオンにすると、ここに並びます。予約した作品は新しい話が配信されるたびに自動で録画されます。'}
      </p>
      {terms.length === 0 ? null : (
        <div className='mt-[11px] flex flex-wrap gap-1.5'>
          {terms.map((term) => (
            <span
              key={term}
              className='inline-flex h-[22px] items-center rounded px-2 text-[11.5px] font-semibold bg-accent text-accent-foreground'
            >
              {term}
            </span>
          ))}
        </div>
      )}
      <div className='mt-3.5 flex flex-wrap gap-2'>
        {filtered ? (
          <button type='button' onClick={onReset} className={btnPrimaryClass}>
            条件をリセット
          </button>
        ) : null}
        <Link to='/browse' className={filtered ? btnClass : btnPrimaryClass}>
          アニメ一覧から探す
        </Link>
      </div>
    </div>
  </div>
)
