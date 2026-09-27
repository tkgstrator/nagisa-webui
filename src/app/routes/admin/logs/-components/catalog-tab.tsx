import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { PagePager } from '@/app/components/page-pager'
import { PageSection, PageToolbar } from '@/app/components/page-section'
import { appLocale } from '@/app/lib/locale'
import { catalogEventsQueryOptions } from '@/app/lib/query-options'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { CatalogEventKindEnum } from '@/schemas/log.dto'
import { catalogKindLabel } from '../-lib/format'
import { CATALOG_MAX_HOURS, HOURS_OPTIONS, type Search, type UpdateSearch } from '../-lib/search'
import { CatalogTable } from './catalog-table'

export function CatalogTab({
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
  const hours = Math.min(search.hours, CATALOG_MAX_HOURS)
  const { data } = useQuery({
    ...catalogEventsQueryOptions({ page, limit, kind: search.catKind, provider: search.catProvider, hours }),
    placeholderData: keepPreviousData
  })
  const kindOptions = [
    { value: undefined, label: content.common.all.value },
    ...CatalogEventKindEnum.options.map((value) => ({ value, label: catalogKindLabel[value] }))
  ]
  return (
    <PageSection>
      <PageToolbar title={content.catalogTab.heading({ count: (data?.total ?? 0).toLocaleString(appLocale) })}>
        <FilterPopover
          outline
          label={content.filters.period.value}
          value={hours}
          options={HOURS_OPTIONS.catalog}
          onSelect={(value) => updateSearch({ hours: value })}
        />
        <FilterPopover
          outline
          label={content.filters.kind.value}
          value={search.catKind}
          options={kindOptions}
          onSelect={(value) => updateSearch({ catKind: value })}
        />
      </PageToolbar>
      <CatalogTable events={data?.data} />
      <PagePager page={page} totalPages={data?.totalPages ?? 0} total={data?.total ?? 0} onPageChange={setPage} />
    </PageSection>
  )
}
