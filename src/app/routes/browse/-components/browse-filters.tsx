import { useIntlayer } from 'react-intlayer'
import { providerLabel } from '@/app/lib/constants'

/** プロバイダのドット色。バッジ用の providerColor と違い前景色だけが要る。 */
const providerDot: Record<string, string> = {
  amazon: 'bg-brand-amazon-foreground',
  hulu: 'bg-brand-hulu-foreground',
  crunchyroll: 'bg-brand-crunchyroll-foreground',
  abema: 'bg-brand-abema-foreground',
  netflix: 'bg-brand-netflix-foreground'
}

const PROVIDERS = ['amazon', 'hulu', 'crunchyroll', 'abema', 'netflix'] as const

const pillClass =
  'inline-flex h-[26px] items-center rounded-full border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.94] aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground'

const checkClass =
  'flex cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] leading-5 text-foreground hover:bg-muted focus-within:bg-muted focus-within:ring-2 focus-within:ring-ring'

const FilterGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className='px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground'>
      {title}
    </h3>
    {children}
  </div>
)

export type BrowseFilterPanelProps = {
  provider: string | undefined
  year: number | undefined
  quarter: number | undefined
  status: string | undefined
  badge: string | undefined
  years: number[]
  hasFilters: boolean
  onChangeProvider: (value: string | undefined) => void
  onChangeYear: (value: number | undefined) => void
  onChangeQuarter: (value: number | undefined) => void
  onChangeStatus: (value: string | undefined) => void
  onChangeBadge: (value: string | undefined) => void
  onReset: () => void
}

/**
 * 絞り込み一式。デスクトップではサイドバーに、640px 以下ではボトムシートに差し込まれる。
 * 配信元・バッジはチェックボックスの見た目だが API が単一値なので、選び直すと前の選択は外れる。
 */
export const BrowseFilterPanel = ({
  provider,
  year,
  quarter,
  status,
  badge,
  years,
  hasFilters,
  onChangeProvider,
  onChangeYear,
  onChangeQuarter,
  onChangeStatus,
  onChangeBadge,
  onReset
}: BrowseFilterPanelProps) => {
  const content = useIntlayer('browse-browse-filters')

  const QUARTERS = [
    { value: 0, label: content.quarters.winter.value },
    { value: 1, label: content.quarters.spring.value },
    { value: 2, label: content.quarters.summer.value },
    { value: 3, label: content.quarters.autumn.value }
  ] as const

  const STATUSES = [
    { value: 'RELEASING', label: content.statuses.releasing.value },
    { value: 'FINISHED', label: content.statuses.finished.value },
    { value: 'NOT_YET_RELEASED', label: content.statuses.notYetReleased.value },
    { value: 'HIATUS', label: content.statuses.hiatus.value },
    { value: 'CANCELLED', label: content.statuses.cancelled.value }
  ] as const

  const BADGES = [
    { value: 'NEW_EPISODE', label: content.badges.newEpisode.value },
    { value: 'RECENTLY_ADDED', label: content.badges.recentlyAdded.value },
    { value: 'COMING_SOON', label: content.badges.comingSoon.value },
    { value: 'EXPIRING', label: content.badges.expiring.value }
  ] as const

  return (
    <div className='flex flex-col gap-4'>
      <FilterGroup title={content.groups.provider.value}>
        <div className='flex flex-col gap-px'>
          {PROVIDERS.map((key) => (
            <label key={key} className={checkClass}>
              <input
                type='checkbox'
                className='ml-1 mr-[3px] size-3.5 shrink-0 accent-primary'
                checked={provider === key}
                onChange={() => onChangeProvider(provider === key ? undefined : key)}
              />
              <span aria-hidden='true' className={`size-2 shrink-0 rounded-full opacity-60 ${providerDot[key]}`} />
              {providerLabel[key]}
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={content.groups.year.value}>
        <div className='flex flex-wrap gap-1.5 px-2.5'>
          <button
            type='button'
            className={pillClass}
            aria-pressed={year === undefined}
            onClick={() => onChangeYear(undefined)}
          >
            {content.allYears}
          </button>
          {years.map((y) => (
            <button
              key={y}
              type='button'
              className={pillClass}
              aria-pressed={year === y}
              onClick={() => onChangeYear(year === y ? undefined : y)}
            >
              {y}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={content.groups.quarter.value}>
        <div className='flex flex-wrap gap-1.5 px-2.5'>
          {QUARTERS.map((q) => (
            <button
              key={q.value}
              type='button'
              className={pillClass}
              aria-pressed={quarter === q.value}
              onClick={() => onChangeQuarter(quarter === q.value ? undefined : q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={content.groups.status.value}>
        <div className='flex flex-wrap gap-1.5 px-2.5'>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type='button'
              className={pillClass}
              aria-pressed={status === s.value}
              onClick={() => onChangeStatus(status === s.value ? undefined : s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={content.groups.badge.value}>
        <div className='flex flex-col gap-px'>
          {BADGES.map((b) => (
            <label key={b.value} className={checkClass}>
              <input
                type='checkbox'
                className='ml-1 mr-[3px] size-3.5 shrink-0 accent-primary'
                checked={badge === b.value}
                onChange={() => onChangeBadge(badge === b.value ? undefined : b.value)}
              />
              {b.label}
            </label>
          ))}
        </div>
      </FilterGroup>

      <button
        type='button'
        onClick={onReset}
        disabled={!hasFilters}
        className='mx-2.5 mt-1 flex h-[30px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40'
      >
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          className='size-[13px]'
          aria-hidden='true'
        >
          <path d='M3 12a9 9 0 1 0 9-9M3 12V5m0 7h7' />
        </svg>
        {content.reset}
      </button>
    </div>
  )
}
