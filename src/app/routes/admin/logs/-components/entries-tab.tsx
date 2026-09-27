import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { PageNotice, PageSection, PageToolbar } from '@/app/components/page-section'
import { Button } from '@/app/components/ui/button'
import { logEntriesQueryOptions } from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { ENTRY_MAX_HOURS, HOURS_OPTIONS, LEVEL_OPTIONS, type Search, type UpdateSearch } from '../-lib/search'
import { EntriesTable } from './entries-table'
import { SummarySearch } from './summary-search'

export function EntriesTab({
  search,
  updateSearch,
  limit
}: {
  search: Search
  updateSearch: UpdateSearch
  limit: number
}) {
  const content = useIntlayer('admin-logs')
  const hours = Math.min(search.hours, ENTRY_MAX_HOURS)
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    ...logEntriesQueryOptions({ limit, level: search.level, hours, q: search.q }),
    placeholderData: keepPreviousData
  })
  const entries = data?.pages.flatMap((p) => p.data) ?? []

  return (
    <PageSection>
      <PageToolbar title={content.entriesTab.heading}>
        <SummarySearch value={search.q ?? ''} onChange={(v) => updateSearch({ q: v || undefined })} />
        <FilterPopover
          outline
          label={content.filters.period.value}
          value={hours}
          options={HOURS_OPTIONS.entries}
          onSelect={(v) => updateSearch({ hours: v })}
        />
        <FilterPopover
          outline
          label={content.filters.level.value}
          value={search.level}
          options={LEVEL_OPTIONS}
          onSelect={(v) => updateSearch({ level: v })}
        />
      </PageToolbar>
      {entries.length === 0 ? (
        <PageNotice tone='mute'>{content.entriesTab.empty}</PageNotice>
      ) : (
        <EntriesTable entries={entries} />
      )}
      <div className='mt-[18px] flex justify-center'>
        <Button
          variant='outline'
          size='pill-sm'
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className='bg-transparent px-4'
        >
          {isFetchingNextPage
            ? content.entriesTab.loading
            : hasNextPage
              ? content.entriesTab.loadMore
              : content.entriesTab.noMore}
        </Button>
      </div>
    </PageSection>
  )
}
