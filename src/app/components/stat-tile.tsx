import type { ReactNode } from 'react'
import { appLocale } from '@/app/lib/locale'
import { cn } from '@/app/lib/utils'

/**
 * 左ボーダーのアクセント色だけがトーンで変わる、モック準拠のフラットなタイル。
 * 値が 0 のときはアクセントを落として「見るべきものが無い」ことを表す。
 */
export type StatTone = 'primary' | 'success' | 'info' | 'warning' | 'destructive' | 'muted'

const toneClass: Record<StatTone, string> = {
  primary: 'border-l-primary',
  success: 'border-l-success',
  info: 'border-l-info',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  muted: 'border-l-muted-foreground'
}

/**
 * 数値 (件数) と文字列 (バージョン・状態名など) の両方を同じ見えで並べる。
 * `unit` は数値の後ろに小さく添える単位で、文字列の値では通常省く。
 */
export const StatTile = ({
  label,
  value,
  unit,
  note,
  tone,
  mono
}: {
  label: string
  value: number | string
  unit?: string
  note?: string
  tone: StatTone
  mono?: boolean
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5',
      value === 0 ? 'border-l-border' : toneClass[tone]
    )}
  >
    <span className='text-xs leading-[1.5] text-muted-foreground'>{label}</span>
    <span
      className={cn(
        'text-[28px] leading-[1.1] tracking-[-0.02em] tabular-nums max-sm:text-2xl',
        value === 0 ? 'font-semibold text-muted-foreground' : 'font-bold',
        mono && 'font-[ui-monospace,SFMono-Regular,Menlo,monospace]'
      )}
    >
      {typeof value === 'number' ? value.toLocaleString(appLocale) : value}
      {unit && <small className='ml-1 text-[13px] font-medium tracking-normal text-muted-foreground'>{unit}</small>}
    </span>
    <span className='text-xs leading-[1.5] text-muted-foreground'>{note ?? ''}</span>
  </div>
)

/** 決定稿の `.pg-stat-grid`。列数は固定せず幅で折り返し、スマホでは 2 列。 */
export const StatGrid = ({ label, children }: { label?: string; children: ReactNode }) => (
  <section
    aria-label={label}
    className='grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5 max-sm:grid-cols-2 max-sm:gap-2.5'
  >
    {children}
  </section>
)
