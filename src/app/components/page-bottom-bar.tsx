import type { ReactNode } from 'react'

/** 決定稿の `.pg-bottombar`。本文の末尾に罫線で区切って置く主操作と補足。 */
export const PageBottomBar = ({ children, note }: { children: ReactNode; note?: ReactNode }) => (
  <div className='mt-6 flex flex-wrap items-center justify-between gap-3.5 border-t border-border pt-[18px]'>
    {children}
    {note && <span className='text-[11.5px] text-muted-foreground'>{note}</span>}
  </div>
)
