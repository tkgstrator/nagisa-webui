import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { PagePager } from '@/app/components/page-pager'
import { PageNotice, PageSection, PageToolbar } from '@/app/components/page-section'
import { appLocale } from '@/app/lib/locale'
import { recordingEventsQueryOptions } from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { HOURS_OPTIONS, REC_KIND_OPTIONS, REC_STATUS_OPTIONS, type Search, type UpdateSearch } from '../-lib/search'
import { RecordingsTable } from './recordings-table'

export function RecordingsTab({
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
  const { data } = useQuery({
    ...recordingEventsQueryOptions({
      page,
      limit,
      kind: search.recKind,
      status: search.recStatus,
      hours: search.hours
    }),
    placeholderData: keepPreviousData
  })
  const events = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <PageSection>
      <PageToolbar title={content.recordingsTab.heading({ count: total.toLocaleString(appLocale) })}>
        <FilterPopover
          outline
          label={content.filters.period.value}
          value={search.hours}
          options={HOURS_OPTIONS.recordings}
          onSelect={(v) => updateSearch({ hours: v })}
        />
        <FilterPopover
          outline
          label={content.filters.kind.value}
          value={search.recKind}
          options={REC_KIND_OPTIONS}
          onSelect={(v) => updateSearch({ recKind: v })}
        />
        <FilterPopover
          outline
          label={content.filters.result.value}
          value={search.recStatus}
          options={REC_STATUS_OPTIONS}
          onSelect={(v) => updateSearch({ recStatus: v })}
        />
      </PageToolbar>
      {events.length === 0 ? (
        <PageNotice tone='mute'>{content.recordingsTab.empty}</PageNotice>
      ) : (
        <RecordingsTable events={events} />
      )}
      <PagePager page={page} totalPages={data?.totalPages ?? 0} total={total} onPageChange={setPage} />
    </PageSection>
  )
}
