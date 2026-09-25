import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { PagePager } from '@/app/components/page-pager'
import { PageNotice, PageSection, PageToolbar } from '@/app/components/page-section'
import { appLocale } from '@/app/lib/locale'
import { syncRunsQueryOptions } from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import {
  HOURS_OPTIONS,
  KIND_OPTIONS,
  RUN_MAX_HOURS,
  type Search,
  STATUS_OPTIONS,
  type UpdateSearch
} from '../-lib/search'
import { RunsTable } from './runs-table'

export function RunsTab({
  search,
  updateSearch,
  page,
  setPage,
  limit
}: {
  search: Search
  updateSearch: UpdateSearch
  page: number
  setPage: (page: number) => void
  limit: number
}) {
  const content = useIntlayer('admin-logs')
  const hours = Math.min(search.hours, RUN_MAX_HOURS)
  const { data } = useQuery({
    ...syncRunsQueryOptions({ page, limit, kind: search.kind, status: search.status, hours }),
    placeholderData: keepPreviousData
  })
  const runs = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <PageSection aria-label={content.runsTab.sectionAriaLabel.value}>
      <PageToolbar title={content.runsTab.heading({ count: total.toLocaleString(appLocale) })}>
        <FilterPopover
          outline
          label={content.filters.period.value}
          value={hours}
          options={HOURS_OPTIONS.runs}
          onSelect={(v) => updateSearch({ hours: v })}
        />
        <FilterPopover
          outline
          label={content.filters.kind.value}
          value={search.kind}
          options={KIND_OPTIONS}
          onSelect={(v) => updateSearch({ kind: v })}
        />
        <FilterPopover
          outline
          label={content.filters.status.value}
          value={search.status}
          options={STATUS_OPTIONS}
          onSelect={(v) => updateSearch({ status: v })}
        />
      </PageToolbar>
      {runs.length === 0 ? <PageNotice tone='mute'>{content.runsTab.empty}</PageNotice> : <RunsTable runs={runs} />}
      <PagePager page={page} totalPages={data?.totalPages ?? 0} total={total} onPageChange={setPage} />
    </PageSection>
  )
}
