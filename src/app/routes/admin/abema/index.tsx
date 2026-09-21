import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/app/components/page-container'
import { Button } from '@/app/components/ui/button'
import api from '@/app/lib/api'
import { queryKeys } from '@/app/lib/query-keys'
import { archiveStatsQueryOptions } from '@/app/lib/query-options'

export const Route = createFileRoute('/admin/abema/')({
  component: AbemaArchivePage
})

/** 左ボーダーのアクセント色だけがトーンで変わる、モック準拠のフラットなタイル。 */
type Tone = 'primary' | 'ok' | 'warn'

const toneClass: Record<Tone, string> = {
  primary: 'border-l-primary',
  ok: 'border-l-success',
  warn: 'border-l-warning'
}

const StatTile = ({
  label,
  value,
  unit,
  note,
  tone
}: {
  label: string
  value: number
  unit: string
  note: string
  tone: Tone
}) => (
  <div
    className={`flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5 ${value === 0 ? 'border-l-border' : toneClass[tone]}`}
  >
    <span className='text-xs leading-[1.5] text-muted-foreground'>{label}</span>
    <span
      className={`text-[28px] leading-[1.1] tracking-[-0.02em] tabular-nums max-sm:text-2xl ${value === 0 ? 'font-semibold text-muted-foreground' : 'font-bold'}`}
    >
      {value.toLocaleString('ja-JP')}
      <small className='ml-1 text-[13px] font-medium tracking-normal text-muted-foreground'>{unit}</small>
    </span>
    <span className='text-xs leading-[1.5] text-muted-foreground'>{note}</span>
  </div>
)

function AbemaArchivePage() {
  const queryClient = useQueryClient()
  const { data: stats, isPending } = useQuery(archiveStatsQueryOptions())

  const enqueueMutation = useMutation({
    mutationFn: () => api.enqueueArchive(undefined),
    onSuccess: ({ enqueued }) => {
      if (enqueued === 0) {
        toast.info('鍵が未取得の作品はありません')
      } else {
        toast.success(`${enqueued} 作品をキューに投入しました`)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.archiveStats })
    },
    onError: () => toast.error('キューへの投入に失敗しました')
  })

  return (
    <PageContainer className='gap-6'>
      <header>
        <h1 className='text-2xl font-bold tracking-tight'>ABEMA 鍵アーカイブ</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          復号鍵が未取得の ABEMA 作品を洗い出し、取得ジョブをキューに投入する
        </p>
      </header>

      {stats === undefined ? (
        <p className='border-l-[3px] border-border px-3.5 py-3 text-sm text-muted-foreground'>
          {isPending ? '集計を読み込んでいます…' : '集計を取得できませんでした'}
        </p>
      ) : (
        <section aria-label='アーカイブ状況' className='grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1'>
          <StatTile
            label='ABEMA 作品'
            value={stats.totalAnime}
            unit='作品'
            note={`うち ${stats.animeFullyArchived.toLocaleString('ja-JP')} 作品が取得済み`}
            tone='primary'
          />
          <StatTile
            label='鍵が未取得の作品'
            value={stats.animeWithMissingKey}
            unit='作品'
            note='投入すると 1 作品 1 ジョブで処理する'
            tone='warn'
          />
          <StatTile
            label='エピソード総数'
            value={stats.totalEpisodes}
            unit='話'
            note={`取得済み ${stats.archivedEpisodes.toLocaleString('ja-JP')} 話 · 未取得 ${stats.pendingEpisodes.toLocaleString('ja-JP')} 話`}
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
          {enqueueMutation.isPending ? '投入中…' : '鍵取得ジョブを投入'}
        </Button>
        <span className='text-xs text-muted-foreground'>
          鍵が未取得の ABEMA 作品をすべてキューに送る。処理はキュー側で順次進む。
        </span>
      </div>
    </PageContainer>
  )
}
