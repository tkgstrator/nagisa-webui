import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'

export type SelectOption<T extends string> = { value: T; label: string }

/** value/label の配列から共通 Select を組む。ツールバーの並び替えなど単純な選択用。 */
export const OptionSelect = <T extends string>({
  value,
  options,
  onValueChange,
  label,
  size = 'sm',
  className
}: {
  value: T
  options: readonly SelectOption<T>[]
  onValueChange: (next: T) => void
  label: string
  size?: 'default' | 'sm'
  /** 幅 (w-*) とレイアウト (max-sm:*) のみ。 */
  className?: string
}) => (
  <Select value={value} onValueChange={(next) => next !== null && onValueChange(next as T)}>
    <SelectTrigger aria-label={label} size={size} className={className}>
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
