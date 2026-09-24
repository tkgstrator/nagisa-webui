import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { providerColor, providerLabel } from '@/app/lib/constants'
import {
  animeDetailQueryOptions,
  animeListQueryOptions,
  animeRecordingStatusQueryOptions
} from '@/app/lib/query-options'
import { type AnimeInfoSchema, type AnimeRecordingTitle, QuarterLabel } from '@/schemas/anime.dto'

// 「録画」「全話」を別々の列にすると 280px のサイドバーでは配信元の欄が潰れて
// バッジや年が折り返すので、"0/12" の 1 列にまとめて左へ幅を返す。
const colClass = 'grid grid-cols-[minmax(0,1fr)_auto] gap-2.5'

const pvClass = 'inline-flex h-[18px] shrink-0 items-center rounded px-[7px] text-[11px] font-semibold'

const tagClass = 'inline-flex h-4 items-center rounded px-[5px] text-[10.5px] leading-none'

type Episode = AnimeInfoSchema['seasons'][number]['episodes'][number]

/**
 * 録れている話数。D1 の `recorded` は library-sync が台帳を追いかけて書く控えで、
 * 台帳の初回取り込みの間は何時間も遅れる。脇の「録画サーバー」は台帳を直接読んでいるので、
 * 台帳に載っている回は D1 が追いついていなくても録画済みとして数え、両者の数字を揃える。
 */
const countRecorded = (seasons: AnimeInfoSchema['seasons'], title: AnimeRecordingTitle | undefined): number => {
  const ids = new Set<string>()
  const numbers = new Set<string>()
  for (const rec of title?.recordings ?? []) {
    if (rec.episode_id !== null) ids.add(rec.episode_id)
    if (rec.season_number !== null && rec.episode_number !== null)
      numbers.add(`${rec.season_number}:${rec.episode_number}`)
  }
  const onDisk = (seasonNumber: number, episode: Episode) =>
    ids.has(episode.episodeId) || numbers.has(`${seasonNumber}:${episode.episodeNumber}`)
  return seasons.reduce(
    (sum, season) =>
      sum + season.episodes.filter((episode) => episode.recorded || onDisk(season.seasonNumber, episode)).length,
    0
  )
}

export function RelatedProviders({ anime }: { anime: AnimeInfoSchema }) {
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

  // 「録画サーバー」と同じクエリ (キーも同じなのでキャッシュを共有する)。
  // nagisa が落ちているときは titles が空で返るので、D1 の控えだけで数える。
  const { data: recording } = useQuery({
    ...animeRecordingStatusQueryOptions(anime.id),
    enabled: anime.aniListId > 0
  })
  const recordingTitle = (item: { id: string; provider: string; contentId: string }) =>
    recording?.titles.find(
      (title) => title.animeId === item.id || (title.provider === item.provider && title.contentId === item.contentId)
    )

  if (anime.aniListId <= 0) return null

  const hasOthers = items.some((item) => item.id !== anime.id)

  return (
    <section aria-labelledby='rel-heading'>
      <h3
        id='rel-heading'
        className='mb-2 flex items-center gap-2 text-xs leading-[18px] text-muted-foreground tabular-nums'
      >
        他の配信元
      </h3>
      {isPending ? (
        <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>読み込み中</p>
      ) : (
        // 左バーはこの箱が 1 本だけ持つ。行にも持たせるとホバーで 2 本に見える。
        <div className='border-l-[3px] border-l-primary py-0.5'>
          <div className={`${colClass} px-2.5 py-1.5 pl-[13px] text-[11px] text-muted-foreground`}>
            <span>配信元</span>
            <span className='text-right'>録画</span>
          </div>
          <div className='flex flex-col'>
            {items.map((item, index) => {
              const current = item.id === anime.id
              // 表示中の行は手元の詳細をそのまま使う (同じ作品を引き直す必要がない)。
              const detail = current ? anime : details[index]?.data
              const episodes = detail?.seasons.flatMap((season) => season.episodes) ?? []
              const expired = item.expiredAt !== null && dayjs(item.expiredAt).isBefore(dayjs())
              const expiring = item.expiredAt !== null && !expired

              const rowClass = `${colClass} items-center border-b border-b-border/60 px-2.5 py-2 pl-[13px] ${current ? 'bg-accent/60' : 'transition-colors hover:bg-muted'} ${expired ? 'text-muted-foreground' : ''}`

              const body = (
                <>
                  <span className='flex min-w-0 flex-col gap-[3px]'>
                    <span className={`truncate text-[13px] ${expired ? 'line-through' : ''}`}>{item.title}</span>
                    <span className='flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground'>
                      <span className={`${pvClass} ${providerColor[item.provider]}`}>
                        {providerLabel[item.provider]}
                      </span>
                      {item.year > 0 && (
                        <span className='whitespace-nowrap'>{`${item.year}年 ${QuarterLabel[item.quarter]}`}</span>
                      )}
                      {expiring && item.expiredAt !== null && (
                        <span
                          className={`${tagClass} shrink-0 whitespace-nowrap border border-warning/45 bg-warning/20 text-warning-foreground`}
                        >
                          {dayjs(item.expiredAt).format('M/D')} 終了
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
                          {countRecorded(detail.seasons, recordingTitle(item))}
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
          {!hasOthers && (
            <p className='px-[13px] py-3.5 text-[12.5px] text-muted-foreground'>他の配信元は見つかりませんでした</p>
          )}
        </div>
      )}
    </section>
  )
}
