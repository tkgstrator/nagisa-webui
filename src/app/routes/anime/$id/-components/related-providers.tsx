import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronRight } from 'lucide-react'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { animeDetailQueryOptions, animeListQueryOptions } from '@/app/lib/query-options'
import { type AnimeInfoSchema, QuarterLabel } from '@/schemas/anime.dto'

const colClass = 'grid grid-cols-[minmax(0,1fr)_52px_52px_14px] gap-2.5 max-sm:grid-cols-[minmax(0,1fr)_46px_14px]'

const pvClass = 'inline-flex h-[18px] shrink-0 items-center rounded px-[7px] text-[11px] font-semibold'

const tagClass = 'inline-flex h-4 items-center rounded px-[5px] text-[10.5px] leading-none'

export function RelatedProviders({ anime }: { anime: AnimeInfoSchema }) {
  const { data, isPending } = useQuery({
    ...animeListQueryOptions({ aniListId: anime.aniListId, limit: 20, sort: 'title', order: 'asc' }),
    enabled: anime.aniListId > 0
  })

  const others = (data?.data ?? []).filter((item) => item.id !== anime.id)

  // 一覧のレスポンスには話数が無いので、行ごとに詳細を引いて「録画 / 全話」を埋める。
  const details = useQueries({
    queries: others.map((item) => ({ ...animeDetailQueryOptions(item.id), staleTime: 5 * 60 * 1000 }))
  })

  if (anime.aniListId <= 0) return null

  const currentEpisodes = anime.seasons.flatMap((season) => season.episodes)
  const currentRecorded = currentEpisodes.filter((episode) => episode.recorded).length

  return (
    <section aria-labelledby='rel-heading'>
      <h3
        id='rel-heading'
        className='flex items-center gap-2 text-xs leading-[18px] text-muted-foreground tabular-nums'
      >
        他の配信元
      </h3>
      {isPending ? (
        <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>読み込み中</p>
      ) : (
        <div className='border-l-[3px] border-l-primary py-0.5'>
          <div className={`${colClass} px-2.5 py-1.5 pl-[13px] text-[11px] text-muted-foreground`}>
            <span>配信元</span>
            <span className='text-right'>録画</span>
            <span className='text-right max-sm:hidden'>全話</span>
            <span />
          </div>
          <div className='flex flex-col'>
            <div
              className={`${colClass} items-center border-b border-b-border/60 border-l-[3px] border-l-primary bg-accent/60 px-2.5 py-2`}
            >
              <span className='flex min-w-0 flex-col gap-[3px]'>
                <span className='truncate text-[13px]'>{anime.title}</span>
                <span className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
                  <span className={`${pvClass} ${providerColor[anime.provider]}`}>{providerLabel[anime.provider]}</span>
                  {anime.year > 0 && `${anime.year}年 ${QuarterLabel[anime.quarter]}`}
                  <span className={`${tagClass} border-transparent bg-primary font-semibold text-primary-foreground`}>
                    表示中
                  </span>
                </span>
              </span>
              <span className='text-right text-[13px] text-muted-foreground tabular-nums'>
                <b className='font-semibold text-foreground'>{currentRecorded}</b>
              </span>
              <span className='text-right text-[13px] text-muted-foreground tabular-nums max-sm:hidden'>
                {currentEpisodes.length}
              </span>
              <span />
            </div>

            {others.map((item, index) => {
              const detail = details[index]?.data
              const episodes = detail?.seasons.flatMap((season) => season.episodes) ?? []
              const expired = item.expiredAt !== null && dayjs(item.expiredAt).isBefore(dayjs())
              const expiring = item.expiredAt !== null && !expired

              return (
                <Link
                  key={item.id}
                  to='/anime/$id'
                  params={{ id: item.id }}
                  className={`${colClass} items-center border-b border-b-border/60 border-l-[3px] border-l-transparent px-2.5 py-2 transition-colors hover:border-l-primary hover:bg-muted ${expired ? 'text-muted-foreground' : ''}`}
                >
                  <span className='flex min-w-0 flex-col gap-[3px]'>
                    <span className={`truncate text-[13px] ${expired ? 'line-through' : ''}`}>{item.title}</span>
                    <span className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
                      <span className={`${pvClass} ${providerColor[item.provider]}`}>
                        {providerLabel[item.provider]}
                      </span>
                      {item.year > 0 && `${item.year}年 ${QuarterLabel[item.quarter]}`}
                      {expiring && item.expiredAt !== null && (
                        <span className={`${tagClass} border border-warning/45 bg-warning/20 text-warning-foreground`}>
                          {dayjs(item.expiredAt).format('M/D')} 終了
                        </span>
                      )}
                    </span>
                  </span>
                  <span className='text-right text-[13px] text-muted-foreground tabular-nums'>
                    {detail === undefined ? (
                      '—'
                    ) : (
                      <b className='font-semibold text-foreground'>
                        {episodes.filter((episode) => episode.recorded).length}
                      </b>
                    )}
                  </span>
                  <span className='text-right text-[13px] text-muted-foreground tabular-nums max-sm:hidden'>
                    {detail === undefined ? '—' : episodes.length}
                  </span>
                  <ChevronRight className='size-3.5 text-muted-foreground' />
                </Link>
              )
            })}
          </div>
          {others.length === 0 && (
            <p className='px-[13px] py-3.5 text-[12.5px] text-muted-foreground'>他の配信元は見つかりませんでした</p>
          )}
        </div>
      )}
    </section>
  )
}
