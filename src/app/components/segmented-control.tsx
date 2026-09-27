import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'
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
  <ToggleGroup
    value={[value]}
    onValueChange={(values) => values[0] && onValueChange(values[0] as T)}
    aria-label={label}
    className={cn('min-w-0 shrink-0', fill && 'max-sm:flex max-sm:w-full')}
  >
    {options.map((option) => (
      <ToggleGroupItem key={option.value} value={option.value} className={cn(fill && 'max-sm:flex-1 max-sm:px-2')}>
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
)
