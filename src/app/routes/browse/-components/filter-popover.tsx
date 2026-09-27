import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { cn } from '@/app/lib/utils'

export function FilterPopover<T extends string | number | boolean | undefined>({
  label,
  value,
  options,
  onSelect,
  outline
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onSelect: (value: T) => void
  /** 管理画面の `.a-btn.a-outline.a-sm`。常に「ラベル: 選択値」を出し、選択中でも塗らない。 */
  outline?: boolean
}) {
  const content = useIntlayer('browse-filter-popover')
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const isActive = value != null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          outline ? (
            <Button type='button' variant='outline' size='pill-sm' className='bg-transparent' />
          ) : (
            <Button
              type='button'
              size='lg'
              variant={isActive ? 'default' : 'ghost'}
              className={isActive ? 'bg-accent text-accent-foreground hover:bg-accent/85' : 'text-muted-foreground'}
            />
          )
        }
      >
        <span>
          {outline
            ? `${label}: ${selected?.label ?? content.allLabel.value}`
            : isActive
              ? (selected?.label ?? content.allLabel.value)
              : label}
        </span>
        <ChevronDown data-icon='inline-end' className='opacity-60' />
      </PopoverTrigger>
      <PopoverContent align='start' className='w-44 p-1.5'>
        {options.map((opt) => {
          const checked = value === opt.value
          return (
            <button
              key={String(opt.value ?? 'all')}
              type='button'
              role='menuitemradio'
              aria-checked={checked}
              onClick={() => {
                onSelect(opt.value)
                setOpen(false)
              }}
              className='flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted aria-checked:font-medium aria-checked:text-accent-foreground'
            >
              <Check className={cn('size-3.5 shrink-0', checked ? 'opacity-100' : 'opacity-0')} />
              <span>{opt.label}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
