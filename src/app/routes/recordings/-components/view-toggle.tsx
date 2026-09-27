import { useIntlayer } from 'react-intlayer'
import type { RecordingsView } from '@/app/lib/atoms'
import { cn } from '@/app/lib/utils'

type ViewToggleProps = {
  view: RecordingsView
  onViewChange: (value: RecordingsView) => void
}

export const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  const content = useIntlayer('recordings-view-toggle')
  const options: { value: RecordingsView; label: string }[] = [
    { value: 'list', label: content.views.list.value },
    { value: 'schedule', label: content.views.schedule.value }
  ]
  return (
    <fieldset className='mt-[18px] border-0 p-0' aria-label={content.ariaLabel.value}>
      <div className='inline-flex rounded-lg border border-border bg-background p-0.5'>
        {options.map(({ value, label }) => (
          <button
            key={value}
            type='button'
            aria-pressed={view === value}
            onClick={() => onViewChange(value)}
            className={cn(
              'inline-flex h-7 items-center rounded-md px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring',
              view === value
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
