/**
 * 左ボーダーのアクセント色だけがトーンで変わる、モック準拠のフラットなタイル。
 * 値が 0 のときはアクセントを落として「見るべきものが無い」ことを表す。
 */
export type StatTone = 'primary' | 'ok' | 'warn' | 'err'

const toneClass: Record<StatTone, string> = {
  primary: 'border-l-primary',
  ok: 'border-l-success',
  warn: 'border-l-warning',
  err: 'border-l-destructive'
}

export const StatTile = ({
  label,
  value,
  unit,
  note,
  tone
}: {
  label: string
  value: number
  unit: string
  note: string
  tone: StatTone
}) => (
  <div
    className={`flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5 ${value === 0 ? 'border-l-border' : toneClass[tone]}`}
  >
    <span className='text-xs leading-[1.5] text-muted-foreground'>{label}</span>
    <span
      className={`text-[28px] leading-[1.1] tracking-[-0.02em] tabular-nums max-sm:text-2xl ${value === 0 ? 'font-semibold text-muted-foreground' : 'font-bold'}`}
    >
      {value.toLocaleString('ja-JP')}
      <small className='ml-1 text-[13px] font-medium tracking-normal text-muted-foreground'>{unit}</small>
    </span>
    <span className='text-xs leading-[1.5] text-muted-foreground'>{note}</span>
  </div>
)
