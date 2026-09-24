import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import { PageContainer } from '@/app/components/page-container'
import { StatTile } from '@/app/components/stat-tile'
import { Button } from '@/app/components/ui/button'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import { archiveStatsQueryOptions } from '@/app/lib/query-options'

/** この画面は ABEMA 専用。API 側は provider を受けるが、ここでは固定 */
const PROVIDER = 'abema'

export const Route = createFileRoute('/admin/abema/')({
  component: AbemaArchivePage
})

function AbemaArchivePage() {
  const content = useIntlayer('admin-abema')
  const queryClient = useQueryClient()
  const { data: stats, isPending } = useQuery(archiveStatsQueryOptions(PROVIDER))

  const enqueueMutation = useMutation({
    mutationFn: () => api.enqueueArchive({ provider: PROVIDER }),
    onSuccess: ({ enqueued }) => {
      if (enqueued === 0) {
        toast.info(content.toast.nothingToEnqueue.value)
      } else {
        toast.success(content.toast.enqueued({ enqueued }).value)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.archiveStats(PROVIDER) })
    },
    onError: () => toast.error(content.toast.enqueueFailed.value)
  })

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>{content.title.value}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{content.description.value}</p>
      </header>

      {stats === undefined ? (
        <p className='border-l-[3px] border-border px-3.5 py-3 text-sm text-muted-foreground'>
          {isPending ? content.loading.value : content.loadError.value}
        </p>
      ) : (
        <section
          aria-label={content.sectionLabel.value}
          className='grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1'
        >
          <StatTile
            label={content.stats.totalAnime.label.value}
            value={stats.totalAnime}
            unit={content.stats.totalAnime.unit.value}
            note={content.stats.totalAnime.note({ count: stats.animeFullyArchived.toLocaleString('ja-JP') }).value}
            tone='primary'
          />
          <StatTile
            label={content.stats.missingKey.label.value}
            value={stats.animeWithMissingKey}
            unit={content.stats.missingKey.unit.value}
            note={content.stats.missingKey.note.value}
            tone='warn'
          />
          <StatTile
            label={content.stats.totalEpisodes.label.value}
            value={stats.totalEpisodes}
            unit={content.stats.totalEpisodes.unit.value}
            note={
              content.stats.totalEpisodes.note({
                archived: stats.archivedEpisodes.toLocaleString('ja-JP'),
                pending: stats.pendingEpisodes.toLocaleString('ja-JP')
              }).value
            }
            tone='ok'
          />
        </section>
      )}

      <div className='flex flex-wrap items-center gap-3 border-t border-border pt-4'>
        <Button
          type='button'
          disabled={enqueueMutation.isPending}
          onClick={() => enqueueMutation.mutate()}
          className='gap-2'
        >
          <KeyRound className='size-4' />
          {enqueueMutation.isPending ? content.enqueueButton.pending.value : content.enqueueButton.idle.value}
        </Button>
        <span className='text-xs text-muted-foreground'>{content.footerNote.value}</span>
      </div>
    </PageContainer>
  )
}
