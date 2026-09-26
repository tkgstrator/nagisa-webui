import dayjs from 'dayjs'
import { useIntlayer } from 'react-intlayer'
import { ProxyImage } from '@/app/components/proxy-image'
import { StatusBadge } from '@/app/components/ui/status-badge'
import type { Tone } from '@/app/components/ui/tone'
import { providerLabel } from '@/app/lib/constants'
import { cn } from '@/app/lib/utils'
import { type AnimeSchema, QuarterLabel } from '@/schemas/anime.dto'

/** id ごとに安定した色相。画像が来るまでのプレースホルダ専用。 */
const hueOf = (seed: string) => {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

export function AnimeCard({
  anime,
  index,
  filterYear,
  filterStatus,
  onFilterYear,
  onFilterStatus,
  onSelect
}: {
  anime: AnimeSchema
  index: number
  filterYear: number | undefined
  filterStatus: string | undefined
  onFilterYear: (year: number | undefined) => void
  onFilterStatus: (status: string | undefined) => void
  onSelect: (animeId: string) => void
}) {
  const content = useIntlayer('browse-anime-card')

  const statusText: Record<string, { label: string; className: string }> = {
    RELEASING: { label: content.status.releasing.value, className: 'text-status-releasing-foreground' },
    FINISHED: { label: content.status.finished.value, className: 'text-status-finished-foreground' },
    NOT_YET_RELEASED: { label: content.status.notYetReleased.value, className: 'text-status-not-yet-foreground' },
    CANCELLED: { label: content.status.cancelled.value, className: 'text-status-cancelled-foreground' },
    HIATUS: { label: content.status.hiatus.value, className: 'text-status-hiatus-foreground' }
  }

  const badgeTag: Record<string, { label: string; tone: Tone; pulse: boolean }> = {
    NEW_EPISODE: { label: content.badge.newEpisode.value, tone: 'info', pulse: true },
    RECENTLY_ADDED: { label: content.badge.recentlyAdded.value, tone: 'success', pulse: false },
    COMING_SOON: { label: content.badge.comingSoon.value, tone: 'warning', pulse: false },
    EXPIRING: { label: content.badge.expiring.value, tone: 'destructive', pulse: false }
  }

  /** 一覧 API にエピソード番号が無いため、代わりに次回配信日 / 配信終了日を出す。 */
  const episodeLine = (item: AnimeSchema) => {
    if (item.expiredAt !== null) return content.expiresOn({ date: dayjs(item.expiredAt).format('M/D') }).value
    if (item.nextEpisodeDate !== null)
      return content.updatesOn({ date: dayjs(item.nextEpisodeDate).format('M/D') }).value
    return null
  }

  const hue = hueOf(anime.id)
  const tag = anime.badge !== null ? badgeTag[anime.badge] : undefined
  const status = statusText[anime.status]
  const episode = episodeLine(anime)

  return (
    <div
      style={{ '--h': hue, animationDelay: `${index * 30}ms` } as React.CSSProperties}
      className='group min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500'
    >
      <button
        type='button'
        onClick={() => onSelect(anime.id)}
        aria-label={content.detailAriaLabel({ title: anime.title }).value}
        className='group/tile block w-full rounded-[10px] text-left focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      >
        {/*
         * 拡大は合成だけで済むよう、動かす層・影・角丸クリップを別要素に分ける。
         * box-shadow を transition すると毎フレーム再描画になり、overflow-hidden + 角丸の
         * 要素自体を拡大するとクリップの再ラスタライズが走ってカクつく。
         * 影は描き終えたものを opacity で出し入れする。
         */}
        <div className='relative rounded-[10px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1.5 group-hover:scale-[1.045]'>
          <span
            aria-hidden='true'
            className='absolute inset-0 rounded-[10px] opacity-0 shadow-[0_22px_34px_-16px_var(--overlay)] transition-opacity duration-300 group-hover:opacity-100'
          />
          <div className='relative aspect-video overflow-hidden rounded-[10px] after:absolute after:inset-0 after:bg-[linear-gradient(180deg,transparent_28%,var(--overlay)_100%)] after:content-[""]'>
            <div className='absolute inset-0 bg-[radial-gradient(120%_100%_at_25%_0%,oklch(0.82_0.11_var(--h)/85%),transparent_55%),linear-gradient(165deg,oklch(0.6_0.15_var(--h))_0%,oklch(0.32_0.13_calc(var(--h)+40))_100%)]' />
            <span
              aria-hidden='true'
              className='absolute -right-1 -top-2 text-[40px] font-extrabold leading-none text-[oklch(0.99_0.01_var(--h))] opacity-[0.16] max-sm:text-[32px]'
            >
              {anime.title.slice(0, 1)}
            </span>
            <ProxyImage
              src={anime.imageUrl}
              alt=''
              slotWidth={350}
              className='absolute inset-0 size-full object-cover [&[role=img]]:hidden'
            />

            {tag !== undefined && (
              <StatusBadge
                tone={tag.tone}
                variant='solid'
                className='absolute top-2 left-2 z-1 h-auto rounded-[4px] px-1.5 py-0.5 text-[9.5px] font-bold'
              >
                {tag.pulse && <span className='size-[5px] animate-pulse rounded-full bg-current' />}
                {tag.label}
              </StatusBadge>
            )}

            <span className='absolute inset-0 z-1 flex items-center justify-center bg-overlay/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible/tile:opacity-100'>
              <svg
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                aria-hidden='true'
                className='size-5 text-overlay-foreground drop-shadow-[0_2px_5px_oklch(0_0_0/45%)]'
              >
                <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z' />
                <circle cx='12' cy='12' r='3' />
              </svg>
            </span>

            <div className='absolute inset-x-[9px] bottom-[9px] z-1 min-w-0 text-[oklch(0.99_0.01_var(--h))]'>
              <p className='truncate text-xs font-bold leading-[1.3] drop-shadow-[0_1px_3px_oklch(0.1_0.02_var(--h)/60%)]'>
                {anime.title}
              </p>
              <div className='mt-1 flex items-center justify-between gap-1.5 text-[10px] opacity-90'>
                <span className='truncate'>{providerLabel[anime.provider] ?? anime.provider}</span>
                {episode !== null && <span className='shrink-0 tabular-nums'>{episode}</span>}
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className='mt-1.5 flex items-center justify-between gap-1.5 text-[11px]'>
        {status !== undefined ? (
          <button
            type='button'
            aria-pressed={filterStatus === anime.status}
            onClick={() => onFilterStatus(filterStatus === anime.status ? undefined : anime.status)}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              status.className
            )}
          >
            <span aria-hidden='true' className='size-[5px] rounded-full bg-current' />
            {status.label}
          </button>
        ) : (
          <span />
        )}
        <button
          type='button'
          aria-pressed={filterYear === anime.year}
          onClick={() => onFilterYear(filterYear === anime.year ? undefined : anime.year)}
          className='whitespace-nowrap rounded-sm tabular-nums text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        >
          {anime.year} {QuarterLabel[anime.quarter]}
        </button>
      </div>
    </div>
  )
}
