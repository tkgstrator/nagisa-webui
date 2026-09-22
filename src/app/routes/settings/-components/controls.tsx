import { useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { cn } from '@/app/lib/utils'
import { settingsAtom } from '../-lib/settings'

/** 1px の隙間を border 色で見せる行の集合。角丸はコンテナ側で切る。 */
export const StPanel = ({ children }: { children: ReactNode }) => (
  <div className='flex flex-col gap-px overflow-hidden rounded-[14px] bg-border'>{children}</div>
)

interface StRowProps {
  /** 丸い背景に載せるアイコン。badge を渡す行では省略する。 */
  icon?: ReactNode
  /** アイコンの代わりに置くピル (配信プロバイダ行)。 */
  badge?: ReactNode
  label?: string
  description?: ReactNode
  tag?: string
  /** 行の並び順。フェードインを 60ms ずつずらすのに使う。 */
  index?: number
  danger?: boolean
  children: ReactNode
}

export const StRow = ({ icon, badge, label, description, tag, index = 0, danger = false, children }: StRowProps) => {
  // 古い保存値に animations が無いことがあるので、明示的に false のときだけ止める。
  const animations = useAtomValue(settingsAtom)?.animations !== false

  return (
    <div
      className={cn(
        'group/row flex items-center justify-between gap-5 border-l-[3px] border-l-transparent bg-background px-[18px] py-3.5 transition-[background-color,border-color] duration-200 focus-within:border-l-primary hover:bg-muted hover:border-l-primary max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4',
        danger && 'border-l-destructive',
        animations &&
          'fill-mode-both animate-in fade-in-0 slide-in-from-bottom-2 duration-[420ms] motion-reduce:animate-none'
      )}
      style={animations ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      <div className='flex min-w-0 items-center gap-3'>
        {badge ?? (
          <span
            className={cn(
              'grid size-[30px] shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors duration-200',
              danger
                ? 'bg-destructive/15 text-destructive group-hover/row:bg-destructive/20'
                : 'group-hover/row:bg-primary/15 group-hover/row:text-primary'
            )}
          >
            {icon}
          </span>
        )}
        <div className='min-w-0'>
          {(label !== undefined || tag !== undefined) && (
            <div className='flex items-center gap-2 text-[13px] font-bold'>
              {label}
              {tag !== undefined && <StTag>{tag}</StTag>}
            </div>
          )}
          {description !== undefined && (
            <div className='mt-[3px] text-[11.5px] text-muted-foreground'>{description}</div>
          )}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-2.5 max-sm:w-full max-sm:justify-between'>{children}</div>
    </div>
  )
}

export const StTag = ({ children }: { children: ReactNode }) => (
  <span className='inline-flex h-[18px] items-center rounded-full bg-secondary px-2 text-[10px] font-bold tracking-[0.03em] text-secondary-foreground'>
    {children}
  </span>
)

/** 右端の補足。数値が入るので tabular-nums 固定。 */
export const StNote = ({ children }: { children: ReactNode }) => (
  <span className='text-[11.5px] tabular-nums text-muted-foreground'>{children}</span>
)

export const StSwitch = ({
  checked,
  onCheckedChange,
  label
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
}) => (
  <button
    type='button'
    role='switch'
    aria-checked={checked}
    aria-label={label}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'relative h-[23px] w-10 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
      checked ? 'bg-primary' : 'bg-input'
    )}
  >
    <span
      aria-hidden='true'
      className={cn(
        'absolute top-0.5 left-0.5 size-[19px] rounded-full transition-transform duration-[240ms] ease-[cubic-bezier(.16,1,.3,1)]',
        checked ? 'translate-x-[17px] bg-primary-foreground' : 'bg-background'
      )}
    />
  </button>
)

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export const StSegment = <T extends string>({
  value,
  options,
  onValueChange,
  label
}: {
  value: T
  options: readonly SegmentOption<T>[]
  onValueChange: (next: T) => void
  label: string
}) => (
  <fieldset aria-label={label} className='flex min-w-0 shrink-0 gap-[3px] rounded-full bg-muted p-[3px] max-sm:w-full'>
    {options.map((option) => (
      <button
        key={option.value}
        type='button'
        aria-pressed={value === option.value}
        onClick={() => onValueChange(option.value)}
        className={cn(
          'h-[26px] shrink-0 rounded-full px-3 text-[12.5px] whitespace-nowrap text-muted-foreground transition-[background-color,color,transform] duration-200 hover:text-foreground active:scale-95 max-sm:flex-1 max-sm:px-2',
          value === option.value && 'bg-primary font-bold text-primary-foreground'
        )}
      >
        {option.label}
      </button>
    ))}
  </fieldset>
)

/** モックの .st-sel。既存の Select をピル型に寄せただけで中身は共通。 */
export const StSelect = <T extends string>({
  value,
  options,
  onValueChange,
  label
}: {
  value: T
  options: readonly SegmentOption<T>[]
  onValueChange: (next: T) => void
  label: string
}) => (
  <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
    <SelectTrigger
      aria-label={label}
      className='gap-[7px] rounded-full px-3 text-[12.5px] tabular-nums transition-colors data-[size=default]:h-[30px] hover:border-primary [&_svg]:size-3'
    >
      <SelectValue>{(v) => options.find((option) => option.value === v)?.label ?? ''}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

/** モックの .st-btn。Dialog の render に素の button を渡したいので class だけ切り出す。 */
export const stButtonClass = (danger = false) =>
  cn(
    'h-[30px] shrink-0 rounded-full border border-input px-3.5 text-[12.5px] font-bold whitespace-nowrap transition-[background-color,border-color,transform] duration-200 hover:bg-muted active:scale-[0.96]',
    danger && 'border-destructive/45 text-destructive hover:bg-destructive/10'
  )

export const StButton = ({
  children,
  onClick,
  danger = false
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
}) => (
  <button type='button' onClick={onClick} className={stButtonClass(danger)}>
    {children}
  </button>
)
