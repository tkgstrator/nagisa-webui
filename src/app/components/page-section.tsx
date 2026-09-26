import type { ReactNode } from 'react'
import { SectionHeading, SectionHeadingCount } from '@/app/components/ui/section-heading'
import { cn } from '@/app/lib/utils'

interface PageSectionProps {
  id?: string
  /** 省略すると見出し行を出さない (セグメントだけの段や、見出しを PageToolbar に持たせる段)。 */
  title?: ReactNode
  'aria-label'?: string
  /** 見出しの右に出る補足 (件数や一文)。more と同時には使わない。 */
  count?: ReactNode
  /** 見出しの右に出る導線。 */
  more?: ReactNode
  children: ReactNode
}

/** 見出し付きのページ内セクション。モックの `.pg-sec` に相当する。 */
export const PageSection = ({ id, title, count, more, children, 'aria-label': ariaLabel }: PageSectionProps) => (
  <section id={id} aria-label={ariaLabel} className='mt-9 scroll-mt-6 first:mt-0 max-sm:mt-7'>
    {title !== undefined && (
      <SectionHeading appearance='plain' compact className='mb-3.5 items-baseline gap-3'>
        <h2>{title}</h2>
        {count !== undefined && <SectionHeadingCount>{count}</SectionHeadingCount>}
        {more}
      </SectionHeading>
    )}
    {children}
  </section>
)

/**
 * 見出しと絞り込みを 1 行に並べる帯。モックの `.pg-toolbar`。
 * 左側は `title` (見出し) か `start` (検索欄などの操作群) のどちらかを渡す。
 */
export const PageToolbar = ({
  title,
  start,
  children
}: {
  title?: ReactNode
  start?: ReactNode
  children: ReactNode
}) => (
  <div className='mb-[18px] flex flex-wrap items-center justify-between gap-3'>
    {title !== undefined && <h2 className='text-base font-bold tabular-nums'>{title}</h2>}
    {start !== undefined && <div className='flex flex-wrap items-center gap-2.5 max-sm:w-full'>{start}</div>}
    <div className='flex flex-wrap items-center gap-2.5'>{children}</div>
  </div>
)

export type NoticeTone = 'mute' | 'warn' | 'err'

const noticeToneClass: Record<NoticeTone, string> = {
  mute: 'border-l-border',
  warn: 'border-l-warning',
  err: 'border-l-destructive'
}

/** 1 行の状態メッセージ (取得中 / 失敗 / 古いデータの警告)。モックの `.pg-notice`。 */
export const PageNotice = ({ tone, children }: { tone: NoticeTone; children: ReactNode }) => (
  <p className={cn('rounded-r-lg border-l-[3px] bg-background px-3.5 py-2.5 text-[12.5px]', noticeToneClass[tone])}>
    {children}
  </p>
)
