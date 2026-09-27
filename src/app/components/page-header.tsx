import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/**
 * 決定稿の `.pg-head`。パンくず代わりの eyebrow・見出し・補足の 3 段と、右肩の操作欄。
 * eyebrow の現在地は `<PageHeaderCurrent />` で太字にする。
 */
export const PageHeader = ({
  eyebrow,
  title,
  sub,
  actions,
  className
}: {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  className?: string
}) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-5', className)}>
    <div>
      {eyebrow && (
        <p className='flex items-center gap-2 text-xs/[18px] text-muted-foreground tabular-nums'>{eyebrow}</p>
      )}
      <h1 className='mt-1 text-2xl font-bold leading-[1.2] tracking-[-0.02em] max-sm:text-xl'>{title}</h1>
      {sub && <p className='mt-1 text-xs/[18px] text-muted-foreground'>{sub}</p>}
    </div>
    {actions && <div className='flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap'>{actions}</div>}
  </div>
)

/** eyebrow の `設定 · <b>管理</b>` 形式。親の区分と現在地を並べる。 */
export const PageEyebrowTrail = ({ parent, current }: { parent: ReactNode; current: ReactNode }) => (
  <span>
    {parent} · <b className='font-semibold text-foreground'>{current}</b>
  </span>
)
