import { useMutation, useQueryClient } from '@tanstack/react-query'
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

  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => api.updateAnime({ scheduled: false }, { params: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.anime.all })
    }
  })

  const onUnschedule = async (id: string) => {
    try {
      await unscheduleMutation.mutateAsync(id)
      toast.success('予約を解除しました')
    } catch {
      toast.error('予約解除に失敗しました')
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
      if (failed === 0) toast.success(`${succeeded} 件の予約を解除しました`)
      else toast.warning(`${succeeded} 件解除、${failed} 件失敗`)
    },
    onError: () => toast.error('一括解除に失敗しました')
  })

  return { unscheduleMutation, onUnschedule, bulkUnscheduleMutation }
}
