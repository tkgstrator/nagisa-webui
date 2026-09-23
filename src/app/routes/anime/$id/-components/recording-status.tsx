import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { animeRecordingStatusQueryOptions } from '@/app/lib/query-options'
import type { AnimeInfoSchema, AnimeRecordingTitle } from '@/schemas/anime.dto'
import type { NagisaJobState } from '@/schemas/nagisa.dto'

const pvClass = 'inline-flex h-[18px] shrink-0 items-center rounded px-[7px] text-[11px] font-semibold'

const jobStateLabel: Record<NagisaJobState, string> = {
  active: '録画中',
  wait: '待機中',
  delayed: '再試行待ち',
  completed: '完了',
  failed: '失敗'
}

/** 1 作品ぶんの録画なので GB で十分。1 GB 未満だけ MB に落とす。 */
const formatSize = (bytes: number): string => {
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}

/** "S1: 1–3, 5" のように、録れている回をシーズンごとの範囲で縮めて出す。 */
function episodeRanges(title: AnimeRecordingTitle): string | null {
  const bySeason = new Map<number, number[]>()
  for (const rec of title.recordings) {
    if (rec.season_number === null || rec.episode_number === null) continue
    const list = bySeason.get(rec.season_number)
    if (list) list.push(rec.episode_number)
    else bySeason.set(rec.season_number, [rec.episode_number])
  }
  if (bySeason.size === 0) return null
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, eps]) => {
      const sorted = [...new Set(eps)].sort((a, b) => a - b)
      const parts: string[] = []
      let start = sorted[0]
      let prev = sorted[0]
      for (const ep of [...sorted.slice(1), Number.NaN]) {
        if (ep === prev + 1) {
          prev = ep
          continue
        }
        parts.push(start === prev ? `${start}` : `${start}–${prev}`)
        start = ep
        prev = ep
      }
      return `S${season}: ${parts.join(', ')}`
    })
    .join(' / ')
}

function TitleRow({ title, current }: { title: AnimeRecordingTitle; current: boolean }) {
  const size = title.recordings.reduce((sum, rec) => sum + rec.size, 0)
  const ranges = episodeRanges(title)
  const rowClass = `flex flex-col gap-1.5 border-b border-b-border/60 px-2.5 py-2 pl-[13px] ${current ? 'bg-accent/60' : title.animeId !== null ? 'transition-colors hover:bg-muted' : ''}`

  const body = (
    <>
      <span className='flex items-center justify-between gap-2'>
        <span className={`${pvClass} ${providerColor[title.provider] ?? 'bg-muted text-muted-foreground'}`}>
          {providerLabel[title.provider] ?? title.provider}
        </span>
        <span className='whitespace-nowrap text-[13px] text-muted-foreground tabular-nums'>
          <b className='font-semibold text-foreground'>{title.recordings.length}</b> 本
          {size > 0 && ` · ${formatSize(size)}`}
        </span>
      </span>
      {ranges !== null && <span className='text-[11.5px] text-muted-foreground tabular-nums'>{ranges}</span>}
      {title.jobs === null ? (
        <span className='text-[11.5px] text-muted-foreground'>キューを読めませんでした</span>
      ) : (
        title.jobs.map((job) => (
          <span key={job.job_id} className='flex items-center justify-between gap-2 text-[11.5px] tabular-nums'>
            <span className={job.state === 'active' ? 'text-primary' : 'text-muted-foreground'}>
              {jobStateLabel[job.state]}
            </span>
            {job.progress !== null && job.progress.total > 0 && (
              <span className='text-muted-foreground'>{`${job.progress.current}/${job.progress.total}`}</span>
            )}
          </span>
        ))
      )}
    </>
  )

  if (current || title.animeId === null) {
    return (
      <div className={rowClass} aria-current={current ? 'page' : undefined}>
        {body}
      </div>
    )
  }
  return (
    <Link to='/anime/$id' params={{ id: title.animeId }} className={rowClass}>
      {body}
    </Link>
  )
}

/**
 * nagisa の台帳から見た、この作品 (同じ AniList id の全配信元) の録画状況。
 * 各話グリッドの「録画済み」は D1 の控えで、こちらはディスクに実際にあるもの。
 */
export function RecordingStatus({ anime }: { anime: AnimeInfoSchema }) {
  const { data, isPending, isError } = useQuery({
    ...animeRecordingStatusQueryOptions(anime.id),
    enabled: anime.aniListId > 0
  })

  if (anime.aniListId <= 0) return null

  let content: React.ReactNode
  if (isPending) {
    content = <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>読み込み中</p>
  } else if (isError || data.error !== null) {
    content = (
      <p className='border-l-[3px] border-l-destructive px-3 py-3.5 text-[12.5px] text-muted-foreground'>
        録画サーバーに問い合わせできませんでした
        {data?.error && <span className='mt-1 block break-all text-[11px]'>{data.error}</span>}
      </p>
    )
  } else if (data.titles.length === 0) {
    content = (
      <p className='border-l-[3px] border-border px-3 py-3.5 text-[12.5px] text-muted-foreground'>
        録画サーバーにはまだ何もありません
      </p>
    )
  } else {
    content = (
      <div className='border-l-[3px] border-l-primary py-0.5'>
        {data.titles.map((title) => (
          <TitleRow key={`${title.provider}/${title.contentId}`} title={title} current={title.animeId === anime.id} />
        ))}
      </div>
    )
  }

  return (
    <section aria-labelledby='rec-status-heading'>
      <h3 id='rec-status-heading' className='mb-2 text-xs leading-[18px] text-muted-foreground'>
        録画サーバー
      </h3>
      {content}
    </section>
  )
}
