import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useIntlayer } from 'react-intlayer'
import { toast } from 'sonner'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'

type UseUnscheduleParams = {
  /** 一括解除が完了したときに呼ぶ。選択のクリアは呼び出し側に任せる。 */
  onBulkDone: () => void
}

/** 単発・一括の予約解除をまとめたフック。確認ダイアログを挟むかどうかは呼び出し側の責務。 */
export const useUnschedule = ({ onBulkDone }: UseUnscheduleParams) => {
  const queryClient = useQueryClient()
  const content = useIntlayer('recordings-use-unschedule')

  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => api.updateAnime({ scheduled: false }, { params: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
    }
  })

  const onUnschedule = async (id: string) => {
    try {
      await unscheduleMutation.mutateAsync(id)
      toast.success(content.unscheduled.value)
    } catch {
      toast.error(content.unscheduleFailed.value)
    }
  }

  const bulkUnscheduleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => api.updateAnime({ scheduled: false }, { params: { id } }))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      const succeeded = results.length - failed
      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
      onBulkDone()
      if (failed === 0) toast.success(content.bulkUnscheduled({ count: succeeded }).value)
      else toast.warning(content.bulkPartial({ succeeded, failed }).value)
    },
    onError: () => toast.error(content.bulkFailed.value)
  })

  return { unscheduleMutation, onUnschedule, bulkUnscheduleMutation }
}
