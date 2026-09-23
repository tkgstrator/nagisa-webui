import type { RecordingsView } from '@/app/lib/atoms'

type ViewToggleProps = {
  view: RecordingsView
  onViewChange: (value: RecordingsView) => void
}

export const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => (
  <fieldset className='mt-[18px] border-0 p-0' aria-label='表示切替'>
    <div className='inline-flex rounded-lg border border-border bg-background p-0.5'>
      {(
        [
          { value: 'list', label: '一覧' },
          { value: 'schedule', label: '週間スケジュール' }
        ] as const
      ).map(({ value, label }) => (
        <button
          key={value}
          type='button'
          aria-pressed={view === value}
          onClick={() => onViewChange(value)}
          className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring ${
            view === value
              ? 'bg-accent font-semibold text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </fieldset>
)
