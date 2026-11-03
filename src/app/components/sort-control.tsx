import { useIntlayer } from 'react-intlayer'
import { OptionSelect, type SelectOption } from '@/app/components/option-select'
import { SegmentedControl } from '@/app/components/segmented-control'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'

export type SortOrder = 'asc' | 'desc'

/** `<key>-<order>` 形式の並び値を key と order に分ける。 */
export const splitSortValue = <K extends string>(value: string): { key: K; order: SortOrder } => {
  const index = value.lastIndexOf('-')
  return { key: value.slice(0, index) as K, order: value.slice(index + 1) === 'asc' ? 'asc' : 'desc' }
}

/**
 * 並び替えのキー (select) と向き (昇順/降順) を別々に操作する 2 コントロール。
 * 状態は従来どおり `<key>-<order>` の 1 文字列で持ち、ここで分解/合成するだけ。
 * 向きはキーを変えても保持し、状態によって隠さない。
 */
export const SortControl = <K extends string>({
  value,
  keys,
  onValueChange,
  label,
  className,
  compact
}: {
  value: string
  keys: readonly SelectOption<K>[]
  onValueChange: (next: string) => void
  label: string
  className?: string
  /** 向きを矢印アイコンだけにする (文言は aria-label / title に残す)。横幅の足りない工具列用。 */
  compact?: boolean
}) => {
  const content = useIntlayer('sort-control')
  const { key, order } = splitSortValue<K>(value)
  const directions = [
    { value: 'asc', label: content.ascending.value, path: 'M12 19V5M5 12l7-7 7 7' },
    { value: 'desc', label: content.descending.value, path: 'M12 5v14M19 12l-7 7-7-7' }
  ] as const
  return (
    <>
      <OptionSelect
        label={label}
        value={key}
        options={keys}
        onValueChange={(next) => onValueChange(`${next}-${order}`)}
        className={className}
      />
      {compact ? (
        <ToggleGroup
          value={[order]}
          onValueChange={(values) => values[0] && onValueChange(`${key}-${values[0]}`)}
          aria-label={content.directionLabel.value}
          className='h-[34px] shrink-0 items-center'
        >
          {directions.map((d) => (
            <ToggleGroupItem
              key={d.value}
              value={d.value}
              aria-label={d.label}
              title={d.label}
              className='w-[26px] px-0'
            >
              <svg
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='mx-auto size-3.5'
                aria-hidden='true'
              >
                <path d={d.path} />
              </svg>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <SegmentedControl<SortOrder>
          label={content.directionLabel.value}
          value={order}
          options={[
            { value: 'asc', label: content.ascending.value },
            { value: 'desc', label: content.descending.value }
          ]}
          onValueChange={(next) => onValueChange(`${key}-${next}`)}
          className='h-[34px] items-center'
        />
      )}
    </>
  )
}
