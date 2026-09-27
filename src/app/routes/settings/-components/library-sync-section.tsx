import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import { recordingSyncStateQueryOptions } from '@/app/lib/query-options'
import { StButton, StNote, StPanel, StRow } from './controls'
import { SyncIcon } from './icons'
import { PgSec } from './section'

export const LibrarySyncSection = () => {
  const content = useIntlayer('settings-library-sync-section')
  const queryClient = useQueryClient()
  // 上流を叩かずローカル D1 だけを見るので、bootstrap 中かどうかの表示は必ず返る。
  const { data: sync } = useQuery(recordingSyncStateQueryOptions())
  const bootstrapping = Boolean(sync?.snapshotCursor || sync?.snapshotStartedAt)

  const syncMutation = useMutation({
    mutationFn: () => api.syncRecordingLibrary(undefined),
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info(content.toast.skipped.value)
      } else if (data.error !== null) {
        toast.error(content.toast.error({ message: data.error }).value)
      } else if (data.aborted !== null) {
        toast.warning(content.toast.aborted({ reason: data.aborted }).value)
      } else if (data.bootstrapInProgress) {
        toast.success(content.toast.successBootstrapping.value)
      } else {
        toast.success(content.toast.success({ upserts: data.upserts, deletes: data.deletes }).value)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.recordingLibrary.syncState })
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
    },
    onError: () => toast.error(content.toast.requestFailed.value)
  })

  return (
    <PgSec id='s-sync' title={content.title.value} count={content.count}>
      <StPanel>
        <StRow index={0} icon={<SyncIcon />} label={content.row.label.value} description={content.row.description}>
          <StNote>{bootstrapping ? content.row.statusBootstrapping : content.row.statusIdle}</StNote>
          <StButton
            onClick={() => {
              // StButton に disabled は無いので、二重送信は呼び出し側のガードで防ぐ。
              if (syncMutation.isPending) return
              syncMutation.mutate()
            }}
          >
            {syncMutation.isPending ? content.row.pendingButton : content.row.idleButton}
          </StButton>
        </StRow>
      </StPanel>
    </PgSec>
  )
}
