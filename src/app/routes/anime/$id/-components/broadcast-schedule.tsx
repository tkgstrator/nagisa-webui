import dayjs from 'dayjs'
import { useIntlayer } from 'react-intlayer'
import { SidebarSlot } from '@/app/components/app-sidebar'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import { formatMonthDay } from '../-lib/format'

const rowClass = 'flex items-baseline justify-between rounded-r-lg border-l-[3px] border-l-transparent px-2.5 py-1.5'

const keyClass = 'text-[11.5px] text-muted-foreground'
const valueClass = 'text-[12.5px] font-semibold tabular-nums'

/**
 * サイドバーに差し込む放送スケジュール。配信予定が無いタイトルでは何も描画しない。
 * 640px 以下ではサイドバーが上部バーになり非表示になるため、ここには本文に無い情報を置かない。
 */
export function BroadcastSchedule({ anime }: { anime: AnimeInfoSchema }) {
  const content = useIntlayer('anime-id-broadcast-schedule')
  const episodes = anime.seasons.flatMap((season) => season.episodes)
  const upcoming = episodes
    .filter((episode) => dayjs(episode.releaseDate).isAfter(dayjs()))
    .sort((a, b) => dayjs(a.releaseDate).valueOf() - dayjs(b.releaseDate).valueOf())

  if (upcoming.length === 0) return null

  const soon = upcoming.slice(0, 3)
  const final = upcoming[upcoming.length - 1]
  const showFinal = final !== undefined && !soon.includes(final)

  return (
    <SidebarSlot>
      <div className='flex flex-col border-t border-t-border pt-3.5 max-sm:hidden'>
        <h3 className='px-2.5 pb-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground'>
          {content.heading}
        </h3>
        {soon.map((episode, index) => {
          const isNow = index === 0 && dayjs(episode.releaseDate).diff(dayjs(), 'day') <= 7
          return (
            <div key={episode.id} className={`${rowClass} ${isNow ? 'border-l-primary bg-accent' : ''}`}>
              <span className={keyClass}>
                {content.episodeLabel({ number: episode.episodeNumber })}
                {isNow && content.thisWeekSuffix}
              </span>
              <span className={valueClass}>{formatMonthDay(episode.releaseDate)}</span>
            </div>
          )
        })}
        {showFinal && (
          <div className={rowClass}>
            <span className={keyClass}>{content.finalEpisode({ count: episodes.length })}</span>
            <span className={valueClass}>{formatMonthDay(final.releaseDate)}</span>
          </div>
        )}
      </div>
    </SidebarSlot>
  )
}
