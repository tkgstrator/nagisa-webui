import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { List } from 'lucide-react'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { z } from 'zod'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { PagePager } from '@/app/components/page-pager'
import { PageNotice, PageToolbar } from '@/app/components/page-section'
import { PosterCard, PosterGrid, PosterMeta, ProviderTag } from '@/app/components/poster-grid'
import { Button } from '@/app/components/ui/button'
import { providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import { unidentifiedListQueryOptions } from '@/app/lib/query-options'
import { getProviderTitleUrl } from '@/app/routes/anime/$id/-lib/format'
import { FilterPopover } from '@/app/routes/browse/-components/filter-popover'
import { SearchBar } from '@/app/routes/browse/-components/search-bar'
import { readSettings, useSettings } from '@/app/routes/settings/-lib/settings'
import { ProviderTypeEnum } from '@/schemas/message.dto'

const Order = z.enum(['asc', 'desc'])

const SearchSchema = z.object({
  provider: ProviderTypeEnum.optional(),
  q: z.string().nonempty().optional(),
  order: Order.default('desc')
})

type Provider = z.infer<typeof ProviderTypeEnum>

export const Route = createFileRoute('/admin/unidentified/')({
  validateSearch: SearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(
      unidentifiedListQueryOptions({
        page: 1,
        limit: readSettings().pageSize,
        provider: deps.provider,
        q: deps.q,
        order: deps.order
      })
    ),
  pendingComponent: LoadingSpinner,
  component: UnidentifiedAdminPage
})

function UnidentifiedAdminPage() {
  const content = useIntlayer('admin-unidentified')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [page, setPage] = useState(1)
  const { settings } = useSettings()

  const PROVIDER_FILTER_OPTIONS: { value: Provider | undefined; label: string }[] = [
    { value: undefined, label: content.filterAll.value },
    { value: 'amazon', label: providerLabel.amazon ?? 'amazon' },
    { value: 'hulu', label: providerLabel.hulu ?? 'hulu' },
    { value: 'crunchyroll', label: providerLabel.crunchyroll ?? 'crunchyroll' },
    { value: 'abema', label: providerLabel.abema ?? 'abema' }
  ]

  const { data } = useQuery({
    ...unidentifiedListQueryOptions({
      page,
      limit: settings.pageSize,
      provider: search.provider,
      q: search.q,
      order: search.order
    }),
    placeholderData: keepPreviousData
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  const updateSearch = (patch: Partial<z.infer<typeof SearchSchema>>) => {
    setPage(1)
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const toggleOrder = () => updateSearch({ order: search.order === 'desc' ? 'asc' : 'desc' })

  return (
    <PageContainer className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.eyebrow.value} current={content.title.value} />}
        title={content.title.value}
        sub={
          <>
            {content.unresolvedCount.prefix.value}{' '}
            <b className='font-semibold text-foreground tabular-nums'>{total.toLocaleString(appLocale)}</b>{' '}
            {content.unresolvedCount.suffix.value}
          </>
        }
      />

      <div>
        <PageToolbar
          start={
            <>
              <SearchBar value={search.q ?? ''} onChange={(v) => updateSearch({ q: v || undefined })} />
              <FilterPopover
                outline
                label={content.providerFilterLabel.value}
                value={search.provider}
                options={PROVIDER_FILTER_OPTIONS}
                onSelect={(v) => updateSearch({ provider: v })}
              />
            </>
          }
        >
          <Button variant='outline' size='pill-sm' className='bg-transparent' onClick={toggleOrder}>
            <List />
            {content.sortButton.prefix.value}{' '}
            {search.order === 'desc' ? content.sortButton.desc.value : content.sortButton.asc.value}
          </Button>
        </PageToolbar>

        {items.length === 0 ? (
          <PageNotice tone='mute'>{content.emptyState.value}</PageNotice>
        ) : (
          <PosterGrid>
            {items.map((item) => (
              <PosterCard
                key={item.id}
                title={item.title}
                imageUrl={item.imageUrl}
                href={getProviderTitleUrl(item.provider, item.contentId)}
              >
                <PosterMeta>
                  <ProviderTag provider={item.provider} />
                  <span className='truncate font-[ui-monospace,SFMono-Regular,Menlo,monospace]'>{item.contentId}</span>
                </PosterMeta>
                <PosterMeta>
                  {content.updatedPrefix.value} {dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm')}
                </PosterMeta>
              </PosterCard>
            ))}
          </PosterGrid>
        )}
      </div>

      <PagePager page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </PageContainer>
  )
}
