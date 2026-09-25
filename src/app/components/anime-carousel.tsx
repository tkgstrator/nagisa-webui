import { Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronRight, Info } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { ProxyImage } from '@/app/components/proxy-image'
import { Carousel, CarouselContent, CarouselItem } from '@/app/components/ui/carousel'
import { providerLabel, providerSolidColor, statusLabel } from '@/app/lib/constants'
import { type AnimeSchema, QuarterLabel } from '@/schemas/anime.dto'

type BadgeType = 'updatedAt' | 'nextEpisodeDate' | 'expiredAt'

type AnimeCarouselContent = ReturnType<typeof useIntlayer<'anime-carousel'>>

/** モックの `.car-badge` / `.poster .tag` のトーン。色は全てデザイントークン経由。 */
type FlagTone = 'new' | 'added' | 'soon' | 'exp'

const flagToneClass: Record<FlagTone, string> = {
  new: 'bg-info text-info-foreground',
  added: 'bg-success text-success-foreground',
  soon: 'bg-warning text-warning-foreground',
  exp: 'bg-destructive text-destructive-foreground'
}

/** 16:9 サムネの下敷き。画像の読み込み前・取得失敗時に見えるグラデーション + 頭文字。 */
const ThumbFallback = ({ title }: { title: string }) => {
  const firstChar = Array.from(title.trim())[0]
  return (
    <>
      <span aria-hidden='true' className='absolute inset-0 bg-gradient-to-br from-muted to-accent' />
      <span
        aria-hidden='true'
        className='absolute top-1 left-2.5 text-[26px] font-extrabold leading-none text-muted-foreground/40'
      >
        {firstChar ?? '?'}
      </span>
    </>
  )
}

/** モックの `.car-wrap` 相当。右端のフェードとドラッグ可能なレールをまとめる。 */
const Rail = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className='relative min-w-0'>
    <Carousel opts={{ align: 'start', dragFree: true, loop: false }} className='w-full min-w-0'>
      <CarouselContent className={`-mt-1 ml-0 gap-3.5 py-1 ${className ?? ''}`}>{children}</CarouselContent>
    </Carousel>
    <span
      aria-hidden='true'
      className='pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-r from-transparent to-background max-sm:w-8'
    />
  </div>
)

const SectionHead = ({ title, subtitle, viewAllLink }: { title: string; subtitle?: string; viewAllLink?: string }) => {
  const content = useIntlayer('anime-carousel')
  return (
    <div className='mb-3 flex items-baseline justify-between gap-3'>
      <h3 className='flex min-w-0 flex-wrap items-center gap-2.5 text-base font-semibold tracking-[-0.01em] max-sm:text-[15px]'>
        {title}
        {subtitle !== undefined && (
          <span className='text-xs font-normal leading-[1.5] text-muted-foreground'>{subtitle}</span>
        )}
      </h3>
      {viewAllLink !== undefined && <ViewAllLink to={viewAllLink} label={content.viewAll.value} />}
    </div>
  )
}

/** モックの `.car-more` / `.more`。ホバーで矢印が少し右へ動く。 */
export const ViewAllLink = ({ to, label, className }: { to: string; label: string; className?: string }) => (
  <Link
    to={to}
    className={`group/more inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className ?? ''}`}
  >
    {label}
    <ChevronRight className='size-3.5 transition-transform group-hover/more:translate-x-0.5' />
  </Link>
)

type AnimeCarouselProps = {
  title: string
  subtitle?: string
  anime: AnimeSchema[]
  viewAllLink?: string
  badgeType?: BadgeType
  flag?: { tone: FlagTone; label: string; pulse?: boolean }
}

/**
 * モックの `.car-head` + `.car-rail`（`.car-tile`）。新着エピソードのような
 * 1 セクション = 1 レールの表示に使う。
 */
export function AnimeCarousel({ title, subtitle, anime, viewAllLink, badgeType, flag }: AnimeCarouselProps) {
  if (anime.length === 0) return null

  return (
    <section className='min-w-0 max-w-full'>
      <SectionHead title={title} subtitle={subtitle} viewAllLink={viewAllLink} />
      <Rail>
        {anime.map((item) => (
          <CarouselItem key={item.id} className='basis-[240px] pl-0 max-sm:basis-[62%]'>
            <CarouselCard anime={item} badgeType={badgeType} flag={flag} />
          </CarouselItem>
        ))}
      </Rail>
    </section>
  )
}

type AnimePosterRailProps = {
  anime: AnimeSchema[]
  badgeType?: BadgeType
  showProvider?: boolean
  showMeta?: boolean
  tag?: { tone: FlagTone; label: (anime: AnimeSchema) => string | null }
}

/**
 * モックの `.panel` 内で使う `.tile` / `.poster` のレール。見出しを持たないので
 * タブや配信元グループの見出しと組み合わせて使う。
 */
export function AnimePosterRail({ anime, badgeType, showProvider = true, showMeta = true, tag }: AnimePosterRailProps) {
  return (
    <Rail>
      {anime.map((item) => (
        <CarouselItem key={item.id} className='basis-[176px] pl-0 max-sm:basis-[44%]'>
          <PosterTile anime={item} badgeType={badgeType} showProvider={showProvider} showMeta={showMeta} tag={tag} />
        </CarouselItem>
      ))}
    </Rail>
  )
}

function roundTo10Min(d: dayjs.Dayjs): dayjs.Dayjs {
  return d.minute(Math.floor(d.minute() / 10) * 10).second(0)
}

function formatDateBadge(date: string, type: BadgeType, content: AnimeCarouselContent): string {
  const d = roundTo10Min(dayjs(date))
  if (type === 'updatedAt') return d.format('M/D H:mm')
  if (type === 'expiredAt') return content.dateBadge.until({ date: d.format('M/D') }).value
  const now = dayjs()
  if (d.isSame(now, 'day')) return content.dateBadge.today({ time: d.format('H:mm') }).value
  if (d.isSame(now.add(1, 'day'), 'day')) return content.dateBadge.tomorrow({ time: d.format('H:mm') }).value
  return d.format('M/D H:mm')
}

function badgeDate(anime: AnimeSchema, badgeType: BadgeType | undefined, content: AnimeCarouselContent): string | null {
  if (badgeType === undefined) return null
  const value =
    badgeType === 'updatedAt' ? anime.updatedAt : badgeType === 'expiredAt' ? anime.expiredAt : anime.nextEpisodeDate
  if (!value) return null
  return formatDateBadge(value, badgeType, content)
}

function seasonLabel(anime: AnimeSchema, content: AnimeCarouselContent): string {
  return content.season({ year: anime.year, quarter: QuarterLabel[anime.quarter] ?? '' }).value
}

/** サムネ右下の録画状態。API が持つのは scheduled / recorded の 2 値のみ。 */
function RecordingState({ anime }: { anime: AnimeSchema }) {
  const content = useIntlayer('anime-carousel')
  if (anime.recorded) {
    return (
      <span className='absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-overlay px-1.5 py-0.5 text-[10.5px] font-semibold text-success dark:text-overlay-foreground'>
        <i className='size-1.5 rounded-full bg-success' />
        {content.recordingState.recorded}
      </span>
    )
  }
  if (anime.scheduled) {
    return (
      <span className='absolute right-2 bottom-2 inline-flex items-center gap-1 rounded bg-overlay px-1.5 py-0.5 text-[10.5px] font-semibold text-overlay-foreground'>
        <i className='size-1.5 animate-pulse rounded-full bg-info' />
        {content.recordingState.scheduled}
      </span>
    )
  }
  return null
}

function CarouselCard({
  anime,
  badgeType,
  flag
}: {
  anime: AnimeSchema
  badgeType?: BadgeType
  flag?: { tone: FlagTone; label: string; pulse?: boolean }
}) {
  const content = useIntlayer('anime-carousel')
  const time = badgeDate(anime, badgeType, content)
  const season = seasonLabel(anime, content)

  return (
    <Link to='/anime/$id' params={{ id: anime.id }} className='group flex min-w-0 flex-col gap-2'>
      <div className='relative aspect-video overflow-hidden rounded-lg transition-transform duration-200 group-hover:-translate-y-[3px]'>
        <ThumbFallback title={anime.title} />
        <ProxyImage
          src={anime.imageUrl}
          alt={anime.title}
          slotWidth={240}
          className='absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105 [&[role=img]]:hidden'
        />
        {flag !== undefined && (
          <span
            className={`absolute top-2 left-2 z-1 inline-flex h-[18px] items-center gap-1 rounded px-1.5 text-[10px] font-semibold ${flagToneClass[flag.tone]}`}
          >
            {flag.pulse === true && <i className='size-[5px] animate-pulse rounded-full bg-current' />}
            {flag.label}
          </span>
        )}
        <span
          className={`absolute bottom-2 left-2 z-1 inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-semibold ${providerSolidColor[anime.provider] ?? 'bg-secondary text-secondary-foreground'}`}
        >
          {providerLabel[anime.provider] ?? anime.provider}
        </span>
        <RecordingState anime={anime} />
      </div>
      <p className='truncate text-[13.5px] font-semibold transition-colors group-hover:text-primary'>{anime.title}</p>
      <div className='flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground'>
        <span className='flex-none font-medium tabular-nums text-foreground'>{season}</span>
        <span className='min-w-0 truncate'>{statusLabel[anime.status] ?? ''}</span>
        {time !== null && <span className='ml-auto flex-none tabular-nums'>{time}</span>}
      </div>
    </Link>
  )
}

function PosterTile({
  anime,
  badgeType,
  showProvider,
  showMeta,
  tag
}: {
  anime: AnimeSchema
  badgeType?: BadgeType
  showProvider: boolean
  showMeta: boolean
  tag?: { tone: FlagTone; label: (anime: AnimeSchema) => string | null }
}) {
  const content = useIntlayer('anime-carousel')
  const tagLabel = tag?.label(anime) ?? null
  const time = badgeDate(anime, badgeType, content)
  const status = statusLabel[anime.status] ?? null

  return (
    <Link to='/anime/$id' params={{ id: anime.id }} className='group block min-w-0'>
      <div className='relative aspect-video overflow-hidden rounded-[10px] transition-transform duration-200 group-hover:-translate-y-[3px]'>
        <ThumbFallback title={anime.title} />
        <ProxyImage
          src={anime.imageUrl}
          alt={anime.title}
          slotWidth={176}
          className='absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105 [&[role=img]]:hidden'
        />
        <span aria-hidden='true' className='absolute inset-0 bg-gradient-to-b from-transparent to-overlay' />
        {tagLabel !== null && (
          <span
            className={`absolute top-2 left-2 z-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${flagToneClass[tag?.tone ?? 'new']}`}
          >
            {tagLabel}
          </span>
        )}
        <span className='absolute inset-0 flex items-center justify-center bg-overlay opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
          <Info className='size-5 text-overlay-foreground' />
        </span>
        <div className='absolute right-2.5 bottom-2.5 left-2.5 z-1'>
          <p className='truncate text-xs font-bold leading-tight text-overlay-foreground drop-shadow-sm'>
            {anime.title}
          </p>
          {showProvider && (
            <div className='mt-1 flex items-center justify-between gap-1.5 text-[10px] text-overlay-foreground/90'>
              <span className='truncate'>{providerLabel[anime.provider] ?? anime.provider}</span>
            </div>
          )}
        </div>
      </div>
      {showMeta && (status !== null || time !== null) && (
        <div className='mt-1.5 flex items-center justify-between gap-1.5 text-[11px]'>
          {status !== null && (
            <span className={`inline-flex items-center gap-1 font-semibold ${statusDotClass(anime.status)}`}>
              <i className='size-[5px] rounded-full bg-current' />
              {status}
            </span>
          )}
          {time !== null && <span className='whitespace-nowrap tabular-nums text-muted-foreground'>{time}</span>}
        </div>
      )}
    </Link>
  )
}

const statusTextColor: Record<string, string> = {
  FINISHED: 'text-status-finished-foreground',
  RELEASING: 'text-status-releasing-foreground',
  NOT_YET_RELEASED: 'text-status-not-yet-foreground',
  CANCELLED: 'text-status-cancelled-foreground',
  HIATUS: 'text-status-hiatus-foreground'
}

function statusDotClass(status: string): string {
  return statusTextColor[status] ?? 'text-muted-foreground'
}
