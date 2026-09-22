import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { AnimeCarousel, AnimePosterRail, ViewAllLink } from '@/app/components/anime-carousel'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { ScheduledUpdatesList } from '@/app/components/scheduled-updates-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { providerColor, providerLabel } from '@/app/lib/constants'
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
        {value.toLocaleString('ja-JP')}
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
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][now.day()]

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
            {formatSeason(season)}クール
          </p>
          <h1 id='h-summary' className='text-[28px] font-bold leading-[1.2] tracking-[-0.02em]'>
            今日の録画状況
          </h1>
          <p className='text-xs leading-[1.5] tabular-nums text-muted-foreground'>
            {`${now.format('M月D日')} (${weekday})`}
          </p>
        </div>

        <div className='grid grid-cols-4 gap-6 max-sm:grid-cols-2 max-sm:gap-x-3.5 max-sm:gap-y-4'>
          <SummaryTile
            to='/browse?badge=NEW_EPISODE'
            label='新着エピソード'
            value={newEpisodes.length}
            unit='作品'
            note={unrecordedNew === 0 ? null : `うち ${unrecordedNew} 作品が未録画`}
            tone='primary'
          />
          <SummaryTile
            to='/recordings'
            label='録画予約中'
            value={scheduledTotal}
            unit='作品'
            note={scheduledUpdates.length === 0 ? null : `直近 ${scheduledUpdates.length} 作品が更新`}
            tone='ok'
          />
          <SummaryTile
            to='/browse?badge=COMING_SOON'
            label='もうすぐ配信'
            value={badged.COMING_SOON.length}
            unit='作品'
            note={null}
            tone='warn'
          />
          <SummaryTile
            to='/browse?badge=EXPIRING'
            label='配信終了予定'
            value={badged.EXPIRING.length}
            unit='作品'
            note={unrecordedExpiring === 0 ? null : `うち ${unrecordedExpiring} 作品が未録画`}
            tone='err'
          />
        </div>
      </section>

      {/* 新着エピソード カルーセル */}
      <AnimeCarousel
        title='新着エピソード'
        subtitle='最近エピソードが追加された作品'
        anime={newEpisodes}
        viewAllLink='/browse?badge=NEW_EPISODE'
        badgeType='nextEpisodeDate'
        flag={{ tone: 'new', label: '新着エピソード', pulse: true }}
      />

      {/* 直近更新の録画予約中作品 */}
      <ScheduledUpdatesList
        anime={scheduledUpdates}
        subtitle={`更新日時が新しい順・最大${SCHEDULED_PREVIEW_LIMIT}件`}
      />

      {/* タブ切り替え */}
      <section aria-labelledby='h-tabs'>
        <h2 id='h-tabs' className='sr-only'>
          カタログを探す
        </h2>
        <Tabs defaultValue='season' className='min-w-0 gap-0'>
          <div className='-mx-1 overflow-x-auto px-1'>
            <TabsList variant='line' className={tabListClass}>
              <TabsTrigger value='season' className={tabTriggerClass}>
                今期アニメ
                <span className={tabCountClass(seasonTotal)}>{seasonTotal}</span>
              </TabsTrigger>
              <TabsTrigger value='added' className={tabTriggerClass}>
                新着追加
                <span className={tabCountClass(badged.RECENTLY_ADDED.length)}>{badged.RECENTLY_ADDED.length}</span>
              </TabsTrigger>
              <TabsTrigger value='coming' className={tabTriggerClass}>
                もうすぐ配信
                <span className={tabCountClass(badged.COMING_SOON.length)}>{badged.COMING_SOON.length}</span>
              </TabsTrigger>
              <TabsTrigger value='expiring' className={tabTriggerClass}>
                配信終了予定
                <span className={tabCountClass(badged.EXPIRING.length)}>{badged.EXPIRING.length}</span>
              </TabsTrigger>
              <TabsTrigger value='provider' className={tabTriggerClass}>
                配信元から探す
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value='season' className='min-w-0 pt-4'>
            {currentSeason.length === 0 ? (
              emptyState('今期の作品はまだありません', 'カタログの取得が終わるとここに表示されます。')
            ) : (
              <AnimePosterRail anime={currentSeason} />
            )}
          </TabsContent>
          <TabsContent value='added' className='min-w-0 pt-4'>
            {badged.RECENTLY_ADDED.length === 0 ? (
              emptyState('新しく追加された作品はありません', '新規追加があるとここに並びます。')
            ) : (
              <AnimePosterRail anime={badged.RECENTLY_ADDED} tag={{ tone: 'added', label: () => '新着追加' }} />
            )}
          </TabsContent>
          <TabsContent value='coming' className='min-w-0 pt-4'>
            {badged.COMING_SOON.length === 0 ? (
              emptyState('配信予定の作品はありません', '配信開始が近づくとここに表示されます。')
            ) : (
              <AnimePosterRail
                anime={badged.COMING_SOON}
                badgeType='nextEpisodeDate'
                tag={{ tone: 'soon', label: () => '配信予定' }}
              />
            )}
          </TabsContent>
          <TabsContent value='expiring' className='min-w-0 pt-4'>
            {badged.EXPIRING.length === 0 ? (
              emptyState('配信終了予定の作品はありません', '終了予定が決まるとここに表示されます。')
            ) : (
              <AnimePosterRail
                anime={badged.EXPIRING}
                badgeType='expiredAt'
                tag={{ tone: 'exp', label: () => '配信終了予定' }}
              />
            )}
          </TabsContent>
          <TabsContent value='provider' className='min-w-0 pt-4'>
            {byProvider.size === 0 ? (
              emptyState('配信元別のデータはありません', '今期の作品が揃うと配信元ごとに並びます。')
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
                      <ViewAllLink to={`/browse?provider=${provider}`} label='すべて見る' />
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
            探す
          </h2>
        </div>
        <div className='mt-3 grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1'>
          <QuickLink
            to='/browse'
            title='アニメ一覧'
            description={
              <>
                今クール <span className='tabular-nums'>{seasonTotal.toLocaleString('ja-JP')}</span> 作品
              </>
            }
          />
          <QuickLink
            to='/recordings'
            title='録画一覧'
            description={
              <>
                予約 <span className='tabular-nums'>{scheduledTotal.toLocaleString('ja-JP')}</span> 作品
              </>
            }
          />
          <QuickLink
            to='/browse?badge=EXPIRING'
            title='配信終了予定'
            tone='warn'
            description={
              <>
                <span className='tabular-nums'>{badged.EXPIRING.length}</span> 作品が終了予定 · 未録画{' '}
                <span className='tabular-nums'>{unrecordedExpiring}</span> 作品
              </>
            }
          />
        </div>
      </section>
    </PageContainer>
  )
}
