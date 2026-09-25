import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/**
 * 決定稿の `.pg-tbl`。管理画面の一覧・内訳表で共用する罫線だけのフラットな表。
 * 行のトーンは先頭セルの内側 3px の影で示す (罫線を足すと列幅がずれるため)。
 */
export type RowTone = 'primary' | 'info' | 'ok' | 'warn' | 'err' | 'mute'

const rowToneClass: Record<RowTone, string> = {
  primary: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-primary)]',
  info: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-info)]',
  ok: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-success)]',
  warn: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-warning)]',
  err: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-destructive)]',
  mute: '[&>td:first-child]:shadow-[inset_3px_0_0_0_var(--color-muted-foreground)]'
}

export const DataTable = ({ head, children }: { head: ReactNode; children: ReactNode }) => (
  <div className='w-full overflow-x-auto'>
    <table className='w-full border-collapse'>
      <thead>
        <tr>{head}</tr>
      </thead>
      <tbody className='[&>tr:last-child>td]:border-b-0'>{children}</tbody>
    </table>
  </div>
)

export const DataTh = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th
    scope='col'
    className={cn(
      'border-b border-border px-2.5 py-2 text-left text-[11px] font-bold whitespace-nowrap text-muted-foreground first:pl-3.5 max-sm:px-1.5 max-sm:text-[11.5px] max-sm:first:pl-2.5',
      right && 'text-right'
    )}
  >
    {children}
  </th>
)

export const DataTr = ({ tone, children }: { tone?: RowTone; children: ReactNode }) => (
  <tr className={cn('[&:hover>td]:bg-muted', tone && rowToneClass[tone])}>{children}</tr>
)

export const DataTd = ({
  children,
  right,
  mono,
  sub,
  className
}: {
  children: ReactNode
  right?: boolean
  /** `.pg-tbl-mono`。cron 式や ID のような機械向けの値。 */
  mono?: boolean
  /** `.pg-tbl-sub`。セル全体を補足文として小さく薄く出す。 */
  sub?: boolean
  className?: string
}) => (
  <td
    className={cn(
      'border-b border-border p-2.5 align-top text-[12.5px] first:pl-3.5 max-sm:px-1.5 max-sm:py-2 max-sm:text-[11.5px] max-sm:first:pl-2.5',
      right && 'text-right tabular-nums',
      mono && 'font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[11.5px]',
      sub && 'text-[11px] text-muted-foreground max-sm:text-[11px]',
      className
    )}
  >
    {children}
  </td>
)

/** セル内の 2 行目 (`.pg-tbl-sub` を span に付けた形)。 */
export const DataSub = ({ children }: { children: ReactNode }) => (
  <span className='mt-0.5 block text-[11px] text-muted-foreground'>{children}</span>
)
