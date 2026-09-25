import { cn } from '@/app/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/**
 * 決定稿の `.a-segments`。押下中のボタンだけ primary で塗るピル型の排他選択。
 * 設定ページのように行幅いっぱいへ伸ばしたいときは `fill` を付ける (モバイルのみ)。
 */
export const SegmentedControl = <T extends string>({
  value,
  options,
  onValueChange,
  label,
  fill
}: {
  value: T
  options: readonly SegmentOption<T>[]
  onValueChange: (next: T) => void
  label: string
  fill?: boolean
}) => (
  <fieldset
    aria-label={label}
    className={cn(
      'inline-flex min-w-0 shrink-0 gap-[3px] rounded-full bg-muted p-[3px]',
      fill && 'max-sm:flex max-sm:w-full'
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type='button'
        aria-pressed={value === option.value}
        onClick={() => onValueChange(option.value)}
        className={cn(
          'h-[26px] shrink-0 rounded-full px-3 text-[12.5px] whitespace-nowrap text-muted-foreground transition-[background-color,color,transform] duration-200 hover:text-foreground active:scale-95',
          fill && 'max-sm:flex-1 max-sm:px-2',
          value === option.value && 'bg-primary font-bold text-primary-foreground'
        )}
      >
        {option.label}
      </button>
    ))}
  </fieldset>
)
