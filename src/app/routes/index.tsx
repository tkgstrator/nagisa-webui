import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useIntlayer } from 'react-intlayer'
import { AnimeCarousel, AnimePosterRail, ViewAllLink } from '@/app/components/anime-carousel'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { ScheduledUpdatesList } from '@/app/components/scheduled-updates-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import { animeListQueryOptions, badgedAnimeQueryOptions } from '@/app/lib/query-options'
import {
  activeSeason,
  formatSeason,
  readSettings,
  type SeasonPin,
  useSettings
} from '@/app/routes/settings/-lib/settings'
import type { AnimeSchema } from '@/schemas/anime.dto'

const SCHEDULED_PREVIEW_LIMIT = 6

/** 設定でピン留めされたクール (無ければ今期) の一覧。API のクールは 0〜3 なので 1 引く。 */
const seasonListQueryOptions = (season: SeasonPin) =>
  animeListQueryOptions({
    year: season.year,
    quarter: season.quarter - 1,
    limit: 100,
    sort: 'title',
    order: 'asc'
  })

const scheduledUpdatesQueryOptions = () =>
  animeListQueryOptions({
    scheduled: true,
    limit: SCHEDULED_PREVIEW_LIMIT,
    page: 1,
    sort: 'updatedAt',
    order: 'desc'
  })

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(badgedAnimeQueryOptions()),
      queryClient.ensureQueryData(seasonListQueryOptions(activeSeason(readSettings()))),
      queryClient.ensureQueryData(scheduledUpdatesQueryOptions())
    ]),
  pendingComponent: LoadingSpinner,
  component: HomePage
})

/** モックの `.ss` タイル。左ボーダーのアクセント色だけがトーンで変わる。 */
type SummaryTone = 'primary' | 'ok' | 'warn' | 'err'

const summaryToneClass: Record<SummaryTone, string> = {
  primary: 'border-l-primary',
  ok: 'border-l-success',
  warn: 'border-l-warning',
  err: 'border-l-destructive'
}

const SummaryTile = ({
  to,
  label,
  value,
  unit,
  note,
  tone
}: {
  to: string
  label: string
  value: number
  unit: string
  /** 行動が要るときだけ入れる。null なら行は空のまま高さだけ確保する。 */
  note: string | null
  tone: SummaryTone
}) => {
  const isZero = value === 0
  return (
    <Link
      to={to}
      className={`flex min-w-0 flex-col gap-0.5 rounded-r-lg border-l-[3px] py-0.5 pr-2 pl-3.5 transition-colors hover:bg-muted ${isZero ? 'border-l-border' : summaryToneClass[tone]}`}
    >
      <span className='flex items-center gap-1.5 text-xs leading-[1.5] text-muted-foreground max-sm:text-[11.5px]'>
        {label}
      </span>
      <span
        className={`text-[28px] leading-[1.1] tracking-[-0.02em] tabular-nums max-sm:text-2xl ${isZero ? 'font-semibold text-muted-foreground' : 'font-bold'}`}
      >
        {value.toLocaleString(appLocale)}
        <small className='ml-1 text-[13px] font-medium tracking-normal text-muted-foreground'>{unit}</small>
      </span>
      <span
        className={`min-h-[18px] text-xs leading-[1.5] ${tone === 'err' ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {note}
      </span>
    </Link>
  )
}

/** モックの `.pg-link`。左ボーダー + ホバーで右に少しずれるフラットな導線。 */
const QuickLink = ({
  to,
  title,
  description,
  tone = 'primary'
}: {
  to: string
  title: string
  description: React.ReactNode
  tone?: 'primary' | 'warn'
}) => (
  <Link
    to={to}
    className={`group/link grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[3px] rounded-r-lg border-l-[3px] px-3.5 py-3 text-sm leading-[1.5] transition-colors hover:bg-muted ${tone === 'warn' ? 'border-l-warning' : 'border-l-primary'}`}
  >
    <span className='text-[13.5px] font-semibold'>{title}</span>
    <ChevronRight className='size-4 text-muted-foreground transition-transform group-hover/link:translate-x-0.5' />
    <span className='col-span-full text-[11.5px] text-muted-foreground'>{description}</span>
  </Link>
)

function HomePage() {
  const content = useIntlayer('home')
  const { data: badged } = useSuspenseQuery(badgedAnimeQueryOptions())
  const { settings } = useSettings()
  const season = activeSeason(settings)
  const [currentSeasonQ, scheduledQ] = useSuspenseQueries({
    queries: [seasonListQueryOptions(season), scheduledUpdatesQueryOptions()]
  })

  const currentSeason = currentSeasonQ.data.data
  const seasonTotal = currentSeasonQ.data.total
  const scheduledUpdates = scheduledQ.data.data
  const scheduledTotal = scheduledQ.data.total

  const byProvider = useMemo(() => {
    const grouped = new Map<string, AnimeSchema[]>()
    for (const anime of currentSeason) {
      const existing = grouped.get(anime.provider)
      if (existing) {
        existing.push(anime)
      } else {
        grouped.set(anime.provider, [anime])
      }
    }
    for (const list of grouped.values()) {
      for (const i of Array.from({ length: list.length - 1 }, (_, k) => list.length - 1 - k)) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    }
    return grouped
  }, [currentSeason])

  const now = dayjs()
  const weekday = content.weekdays[now.day()].value

  const newEpisodes = badged.NEW_EPISODE
  const unrecordedNew = newEpisodes.filter((anime) => !anime.recorded).length
  const unrecordedExpiring = badged.EXPIRING.filter((anime) => !anime.recorded).length

  const emptyState = (title: string, description: string) => (
    <div className='border-y border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground'>
      <b className='mb-1 block text-[13px] font-semibold text-foreground'>{title}</b>
      {description}
    </div>
  )

  const tabListClass =
    'h-[38px] w-max min-w-full gap-0.5 rounded-none bg-transparent p-0 shadow-[inset_0_-1px_0_var(--border)] group-data-horizontal/tabs:h-[38px]'
  const tabTriggerClass =
    'group/tab h-[38px] flex-none gap-[7px] rounded-none border-b-2 border-transparent px-3 text-sm font-normal text-muted-foreground after:hidden hover:bg-muted/65 hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:font-semibold data-active:text-foreground data-active:hover:bg-transparent dark:data-active:border-transparent dark:data-active:border-b-primary dark:data-active:bg-transparent'
  const tabCountClass = (value: number) =>
    `text-xs tabular-nums text-muted-foreground group-data-active/tab:font-semibold group-data-active/tab:text-primary ${value === 0 ? 'opacity-45' : ''}`

  return (
    <PageContainer className='gap-10 max-sm:gap-[30px]'>
      {/* ページヘッド + サマリ。左＝見出しブロック / 右＝タイル4枚 の2カラム。 */}
      <section
        aria-labelledby='h-summary'
        className='grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-10 max-lg:grid-cols-1 max-lg:gap-y-6'
      >
        <div className='flex min-w-0 flex-col gap-1'>
          <p className='text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground'>
            {content.summary.seasonSuffix({ season: formatSeason(season) })}
          </p>
          <h1 id='h-summary' className='text-[28px] font-bold leading-[1.2] tracking-[-0.02em]'>
            {content.summary.title}
          </h1>
          <p className='text-xs leading-[1.5] tabular-nums text-muted-foreground'>
            {`${now.format(content.summary.dateFormat.value)} (${weekday})`}
          </p>
        </div>

        {/* 内容幅で右端に寄せる。均等割りだと最終列の右に空きが残り、右揃えに見えない。 */}
        <div className='grid grid-cols-[repeat(4,max-content)] justify-end gap-12 max-lg:grid-cols-4 max-lg:justify-normal max-lg:gap-6 max-sm:grid-cols-2 max-sm:gap-x-3.5 max-sm:gap-y-4'>
          <SummaryTile
            to='/browse?badge=NEW_EPISODE'
            label={content.summary.tiles.newEpisode.label.value}
            value={newEpisodes.length}
            unit={content.summary.tiles.newEpisode.unit.value}
            note={unrecordedNew === 0 ? null : content.summary.tiles.newEpisode.note({ count: unrecordedNew }).value}
            tone='primary'
          />
          <SummaryTile
            to='/recordings'
            label={content.summary.tiles.scheduled.label.value}
            value={scheduledTotal}
            unit={content.summary.tiles.scheduled.unit.value}
            note={
              scheduledUpdates.length === 0
                ? null
                : content.summary.tiles.scheduled.note({ count: scheduledUpdates.length }).value
            }
            tone='ok'
          />
          <SummaryTile
            to='/browse?badge=COMING_SOON'
            label={content.summary.tiles.comingSoon.label.value}
            value={badged.COMING_SOON.length}
            unit={content.summary.tiles.comingSoon.unit.value}
            note={null}
            tone='warn'
          />
          <SummaryTile
            to='/browse?badge=EXPIRING'
            label={content.summary.tiles.expiring.label.value}
            value={badged.EXPIRING.length}
            unit={content.summary.tiles.expiring.unit.value}
            note={
              unrecordedExpiring === 0 ? null : content.summary.tiles.expiring.note({ count: unrecordedExpiring }).value
            }
            tone='err'
          />
        </div>
      </section>

      {/* 新着エピソード カルーセル */}
      <AnimeCarousel
        title={content.newEpisodes.title.value}
        subtitle={content.newEpisodes.subtitle.value}
        anime={newEpisodes}
        viewAllLink='/browse?badge=NEW_EPISODE'
        badgeType='nextEpisodeDate'
        flag={{ tone: 'new', label: content.newEpisodes.flagLabel.value, pulse: true }}
      />

      {/* 直近更新の録画予約中作品 */}
      <ScheduledUpdatesList
        anime={scheduledUpdates}
        subtitle={content.scheduledUpdates.subtitle({ limit: SCHEDULED_PREVIEW_LIMIT }).value}
      />

      {/* タブ切り替え */}
      <section aria-labelledby='h-tabs'>
        <h2 id='h-tabs' className='sr-only'>
          {content.tabs.sectionTitle}
        </h2>
        <Tabs defaultValue='season' className='min-w-0 gap-0'>
          <div className='-mx-1 overflow-x-auto px-1'>
            <TabsList variant='line' className={tabListClass}>
              <TabsTrigger value='season' className={tabTriggerClass}>
                {content.tabs.season}
                <span className={tabCountClass(seasonTotal)}>{seasonTotal}</span>
              </TabsTrigger>
              <TabsTrigger value='added' className={tabTriggerClass}>
                {content.tabs.added}
                <span className={tabCountClass(badged.RECENTLY_ADDED.length)}>{badged.RECENTLY_ADDED.length}</span>
              </TabsTrigger>
              <TabsTrigger value='coming' className={tabTriggerClass}>
                {content.tabs.comingSoon}
                <span className={tabCountClass(badged.COMING_SOON.length)}>{badged.COMING_SOON.length}</span>
              </TabsTrigger>
              <TabsTrigger value='expiring' className={tabTriggerClass}>
                {content.tabs.expiring}
                <span className={tabCountClass(badged.EXPIRING.length)}>{badged.EXPIRING.length}</span>
              </TabsTrigger>
              <TabsTrigger value='provider' className={tabTriggerClass}>
                {content.tabs.provider}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value='season' className='min-w-0 pt-4'>
            {currentSeason.length === 0 ? (
              emptyState(content.tabs.empty.season.title.value, content.tabs.empty.season.description.value)
            ) : (
              <AnimePosterRail anime={currentSeason} />
            )}
          </TabsContent>
          <TabsContent value='added' className='min-w-0 pt-4'>
            {badged.RECENTLY_ADDED.length === 0 ? (
              emptyState(content.tabs.empty.added.title.value, content.tabs.empty.added.description.value)
            ) : (
              <AnimePosterRail
                anime={badged.RECENTLY_ADDED}
                tag={{ tone: 'added', label: () => content.tabs.tags.added.value }}
              />
            )}
          </TabsContent>
          <TabsContent value='coming' className='min-w-0 pt-4'>
            {badged.COMING_SOON.length === 0 ? (
              emptyState(content.tabs.empty.comingSoon.title.value, content.tabs.empty.comingSoon.description.value)
            ) : (
              <AnimePosterRail
                anime={badged.COMING_SOON}
                badgeType='nextEpisodeDate'
                tag={{ tone: 'soon', label: () => content.tabs.tags.comingSoon.value }}
              />
            )}
          </TabsContent>
          <TabsContent value='expiring' className='min-w-0 pt-4'>
            {badged.EXPIRING.length === 0 ? (
              emptyState(content.tabs.empty.expiring.title.value, content.tabs.empty.expiring.description.value)
            ) : (
              <AnimePosterRail
                anime={badged.EXPIRING}
                badgeType='expiredAt'
                tag={{ tone: 'exp', label: () => content.tabs.tags.expiring.value }}
              />
            )}
          </TabsContent>
          <TabsContent value='provider' className='min-w-0 pt-4'>
            {byProvider.size === 0 ? (
              emptyState(content.tabs.empty.provider.title.value, content.tabs.empty.provider.description.value)
            ) : (
              <div className='space-y-5'>
                {Array.from(byProvider.entries()).map(([provider, anime]) => (
                  <div key={provider}>
                    <div className='mb-2.5 flex items-center justify-between gap-3'>
                      <span
                        className={`inline-flex h-[22px] items-center rounded px-2.5 text-xs font-semibold ${providerColor[provider] ?? 'bg-secondary text-secondary-foreground'}`}
                      >
                        {providerLabel[provider] ?? provider}
                      </span>
                      <ViewAllLink to={`/browse?provider=${provider}`} label={content.tabs.viewAll.value} />
                    </div>
                    <AnimePosterRail anime={anime} showProvider={false} showMeta={false} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* 各画面への導線 */}
      <section aria-labelledby='h-links'>
        <div className='flex flex-wrap items-baseline justify-between gap-3'>
          <h2 id='h-links' className='text-lg font-bold tracking-[-0.01em]'>
            {content.links.sectionTitle}
          </h2>
        </div>
        <div className='mt-3 grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1'>
          <QuickLink
            to='/browse'
            title={content.links.browse.title.value}
            description={
              <>
                {content.links.browse.prefix}{' '}
                <span className='tabular-nums'>{seasonTotal.toLocaleString(appLocale)}</span>{' '}
                {content.links.browse.suffix}
              </>
            }
          />
          <QuickLink
            to='/recordings'
            title={content.links.recordings.title.value}
            description={
              <>
                {content.links.recordings.prefix}{' '}
                <span className='tabular-nums'>{scheduledTotal.toLocaleString(appLocale)}</span>{' '}
                {content.links.recordings.suffix}
              </>
            }
          />
          <QuickLink
            to='/browse?badge=EXPIRING'
            title={content.links.expiring.title.value}
            tone='warn'
            description={
              <>
                <span className='tabular-nums'>{badged.EXPIRING.length}</span> {content.links.expiring.countLabel}{' '}
                <span className='tabular-nums'>{unrecordedExpiring}</span> {content.links.expiring.unit}
              </>
            }
          />
        </div>
      </section>
    </PageContainer>
  )
}
