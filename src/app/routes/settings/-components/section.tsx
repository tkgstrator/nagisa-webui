import type { ReactNode } from 'react'
import { ChevronRightIcon } from './icons'

interface PgSecProps {
  id: string
  title: string
  /** 見出しの右に出る補足 (件数や一文)。more と同時には使わない。 */
  count?: ReactNode
  /** 見出しの右に出る導線。SecMoreLink を渡す。 */
  more?: ReactNode
  children: ReactNode
}

export const PgSec = ({ id, title, count, more, children }: PgSecProps) => (
  <section id={id} className='mt-9 scroll-mt-6 first:mt-0 max-sm:mt-7'>
    <div className='mb-3.5 flex flex-wrap items-baseline justify-between gap-3'>
      <h2 className='text-base font-bold'>{title}</h2>
      {count !== undefined && <span className='text-xs tabular-nums text-muted-foreground'>{count}</span>}
      {more}
    </div>
    {children}
  </section>
)

/** 見出し右の「◯◯を開く ›」。Link を子に取ってスタイルだけを与える。 */
export const secMoreClass =
  'inline-flex items-center gap-[3px] text-xs text-muted-foreground transition-colors hover:text-foreground'

export const SecMoreLabel = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <ChevronRightIcon />
  </>
)
