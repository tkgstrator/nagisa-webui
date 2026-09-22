import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronRight } from 'lucide-react'
import { ProxyImage } from '@/app/components/proxy-image'
import { providerColor, providerLabel } from '@/app/lib/constants'
import type { AnimeSchema } from '@/schemas/anime.dto'

type ScheduledUpdatesListProps = {
  anime: AnimeSchema[]
  subtitle?: string
}

/** モックの `.su-row` と同じグリッド定義。列は サムネ / 作品 / 更新 の 3 列。列見出しは持たない。 */
const rowGrid = 'grid grid-cols-[76px_minmax(0,1fr)_84px] items-center gap-3 max-sm:grid-cols-[56px_minmax(0,1fr)_60px]'

/** 「N 分前」のような相対表記。dayjs の relativeTime プラグインには依存しない。 */
function relativeLabel(date: string): string {
  const d = dayjs(date)
  const now = dayjs()
  const minutes = now.diff(d, 'minute')
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes} 分前`
  const hours = now.diff(d, 'hour')
  if (hours < 24 && d.isSame(now, 'day')) return `${hours} 時間前`
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨日'
  const days = now.diff(d, 'day')
  if (days < 7) return `${days} 日前`
  return d.format('M/D')
}

/**
 * モックの `.su-box`。録画予約中の作品を更新日時の新しい順に並べたルールドリスト。
 * SPEC.md の通り複合指標は 1 セルに詰めず、状態はタグ、更新日時は独立した右寄せ列に置く。
 */
export function ScheduledUpdatesList({ anime, subtitle }: ScheduledUpdatesListProps) {
  if (anime.length === 0) {
    return (
      <section className='border-l-[3px] border-border py-5 pr-3 pl-[13px]'>
        <p className='text-[12.5px] text-muted-foreground'>録画予約中の作品はまだありません。</p>
        <Link
          to='/browse'
          className='group/cta mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline'
        >
          アニメ一覧から予約する
          <ChevronRight className='size-3.5 transition-transform group-hover/cta:translate-x-0.5' />
        </Link>
      </section>
    )
  }

  return (
    <section className='border-l-[3px] border-primary'>
      <div className='flex flex-wrap items-baseline justify-between gap-3 border-b border-border py-1 pr-2.5 pb-2 pl-[13px]'>
        <h3 className='text-[13px] font-bold'>
          録画予約中の更新
          {subtitle !== undefined && (
            <span className='ml-2 text-[11.5px] font-normal text-muted-foreground max-sm:ml-0 max-sm:block'>
              {subtitle}
            </span>
          )}
        </h3>
        <Link
          to='/recordings'
          className='group/more inline-flex items-center gap-0.5 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground'
        >
          録画一覧へ
          <ChevronRight className='size-3.5 transition-transform group-hover/more:translate-x-0.5' />
        </Link>
      </div>

      <div>
        {anime.map((item) => (
          <Link
            key={item.id}
            to='/anime/$id'
            params={{ id: item.id }}
            className={`${rowGrid} border-b border-b-border/60 py-2 pr-2.5 pl-[13px] transition-colors hover:bg-muted`}
          >
            <ProxyImage
              src={item.imageUrl}
              alt={item.title}
              slotWidth={76}
              className='aspect-video w-full rounded object-cover'
            />
            <span className='min-w-0'>
              <span className='block truncate text-[13px] font-medium'>{item.title}</span>
              <span className='mt-[3px] flex flex-wrap items-center gap-[7px] text-[11px] text-muted-foreground'>
                <span
                  className={`inline-flex h-[17px] flex-none items-center rounded px-1.5 text-[10.5px] font-semibold ${providerColor[item.provider] ?? 'bg-secondary text-secondary-foreground'}`}
                >
                  {providerLabel[item.provider] ?? item.provider}
                </span>
                {item.recorded ? (
                  <span className='inline-flex h-4 flex-none items-center rounded border border-success/45 px-1.5 text-[10.5px] leading-none text-success dark:text-foreground'>
                    録画済み
                  </span>
                ) : (
                  <span className='inline-flex h-4 flex-none items-center rounded border border-border px-1.5 text-[10.5px] leading-none dark:text-foreground'>
                    未録画
                  </span>
                )}
                {item.expiredAt !== null && (
                  <span className='inline-flex h-4 flex-none items-center rounded border border-warning/45 bg-warning/20 px-1.5 text-[10.5px] leading-none text-warning-foreground'>
                    配信終了予定
                  </span>
                )}
              </span>
            </span>
            <span className='whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground'>
              <span className='block'>{relativeLabel(item.updatedAt)}</span>
              <span className='block text-[10.5px] opacity-75 max-sm:hidden'>
                {dayjs(item.updatedAt).format('M/D H:mm')}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
