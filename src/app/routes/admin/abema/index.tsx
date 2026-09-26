import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import { PageBottomBar } from '@/app/components/page-bottom-bar'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { StatGrid, StatTile } from '@/app/components/stat-tile'
import { Button } from '@/app/components/ui/button'
import api from '@/app/lib/api'
import { appLocale } from '@/app/lib/locale'
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
    <PageContainer narrow className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.eyebrow.value} current={content.title.value} />}
        title={content.title.value}
        sub={content.description.value}
      />

      <div>
        {stats === undefined ? (
          <p className='border-l-[3px] border-border px-3.5 py-3 text-sm text-muted-foreground'>
            {isPending ? content.loading.value : content.loadError.value}
          </p>
        ) : (
          <StatGrid label={content.sectionLabel.value}>
            <StatTile
              label={content.stats.totalAnime.label.value}
              value={stats.totalAnime}
              unit={content.stats.totalAnime.unit.value}
              note={content.stats.totalAnime.note({ count: stats.animeFullyArchived.toLocaleString(appLocale) }).value}
              tone='primary'
            />
            <StatTile
              label={content.stats.missingKey.label.value}
              value={stats.animeWithMissingKey}
              unit={content.stats.missingKey.unit.value}
              note={content.stats.missingKey.note.value}
              tone='warning'
            />
            <StatTile
              label={content.stats.totalEpisodes.label.value}
              value={stats.totalEpisodes}
              unit={content.stats.totalEpisodes.unit.value}
              note={
                content.stats.totalEpisodes.note({
                  archived: stats.archivedEpisodes.toLocaleString(appLocale),
                  pending: stats.pendingEpisodes.toLocaleString(appLocale)
                }).value
              }
              tone='success'
            />
          </StatGrid>
        )}

        <PageBottomBar note={content.footerNote.value}>
          <Button
            type='button'
            size='pill'
            disabled={enqueueMutation.isPending}
            onClick={() => enqueueMutation.mutate()}
          >
            <KeyRound />
            {enqueueMutation.isPending ? content.enqueueButton.pending.value : content.enqueueButton.idle.value}
          </Button>
        </PageBottomBar>
      </div>
    </PageContainer>
  )
}
