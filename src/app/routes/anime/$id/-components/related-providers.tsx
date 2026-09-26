import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useIntlayer } from 'react-intlayer'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { animeDetailQueryOptions, animeListQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'
import { type AnimeInfoSchema, QuarterLabel } from '@/schemas/anime.dto'

// 「録画」「全話」を別々の列にすると 280px のサイドバーでは配信元の欄が潰れて
// バッジや年が折り返すので、"0/12" の 1 列にまとめて左へ幅を返す。
const colClass = 'grid grid-cols-[minmax(0,1fr)_auto] gap-2.5'

const tagClass = 'inline-flex h-4 items-center rounded px-[5px] text-[10.5px] leading-none'

export function RelatedProviders({ anime }: { anime: AnimeInfoSchema }) {
  const content = useIntlayer('anime-id-related-providers')
  const { data, isPending } = useQuery({
    ...animeListQueryOptions({ aniListId: anime.aniListId, limit: 20, sort: 'title', order: 'asc' }),
    enabled: anime.aniListId > 0
  })

  // 表示中の作品もこの一覧に含まれる。抜き出して先頭に固定すると開いた作品で並びが変わるので、
  // API の並び (title asc) のまま出して、選択中であることは背景色だけで示す。
  const items = data?.data ?? []

  // 一覧のレスポンスには話数が無いので、行ごとに詳細を引いて「録画 / 全話」を埋める。
  const details = useQueries({
    queries: items.map((item) => ({ ...animeDetailQueryOptions(item.id), staleTime: 5 * 60 * 1000 }))
  })

  if (anime.aniListId <= 0) return null

  const hasOthers = items.some((item) => item.id !== anime.id)

  return (
    <section aria-labelledby='rel-heading'>
      <h3
        id='rel-heading'
        className='mb-2 flex items-center gap-2 text-xs leading-[18px] text-muted-foreground tabular-nums'
      >
        {content.heading}
      </h3>
      {isPending ? (
        <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>
          {content.loading}
        </p>
      ) : (
        // 左バーはこの箱が 1 本だけ持つ。行にも持たせるとホバーで 2 本に見える。
        <div className='border-l-[3px] border-l-primary py-0.5'>
          <div className='flex flex-col'>
            {items.map((item, index) => {
              const current = item.id === anime.id
              // 表示中の行は手元の詳細をそのまま使う (同じ作品を引き直す必要がない)。
              const detail = current ? anime : details[index]?.data
              const episodes = detail?.seasons.flatMap((season) => season.episodes) ?? []
              const expired = item.expiredAt !== null && dayjs(item.expiredAt).isBefore(dayjs())
              const expiring = item.expiredAt !== null && !expired

              const rowClass = cn(
                colClass,
                'items-center border-b border-b-border/60 px-2.5 py-2 pl-[13px]',
                current ? 'bg-accent/60' : 'transition-colors hover:bg-muted',
                expired && 'text-muted-foreground'
              )

              const body = (
                <>
                  <span className='flex min-w-0 flex-col gap-[3px]'>
                    <span className={cn('truncate text-[13px]', expired && 'line-through')}>{item.title}</span>
                    <span className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
                      <StatusBadge size='sm' className={cn('h-[18px] rounded', providerColor[item.provider])}>
                        {providerLabel[item.provider]}
                      </StatusBadge>
                      {item.year > 0 && (
                        <span className='whitespace-nowrap'>
                          {content.yearWithQuarter({ year: item.year, quarter: QuarterLabel[item.quarter] })}
                        </span>
                      )}
                      {expiring && item.expiredAt !== null && (
                        <span
                          className={cn(
                            tagClass,
                            'shrink-0 whitespace-nowrap border border-warning/45 bg-warning/20 text-warning-foreground'
                          )}
                        >
                          {content.expiring({ date: dayjs(item.expiredAt).format('M/D') })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className='whitespace-nowrap text-right text-[13px] text-muted-foreground tabular-nums'>
                    {detail === undefined ? (
                      '—'
                    ) : (
                      <>
                        <b className='font-semibold text-foreground'>
                          {episodes.filter((episode) => episode.recorded).length}
                        </b>
                        {`/${episodes.length}`}
                      </>
                    )}
                  </span>
                </>
              )

              return current ? (
                <div key={item.id} aria-current='page' className={rowClass}>
                  {body}
                </div>
              ) : (
                <Link key={item.id} to='/anime/$id' params={{ id: item.id }} className={rowClass}>
                  {body}
                </Link>
              )
            })}
          </div>
          {!hasOthers && <p className='px-[13px] py-3.5 text-[12.5px] text-muted-foreground'>{content.empty}</p>}
        </div>
      )}
    </section>
  )
}
